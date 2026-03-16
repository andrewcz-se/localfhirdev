// Ensure the message has at least one OBX segment before processing
if (msg['OBX'].length() > 0) {
    
    // --- 1. Extract Header Info for Provenance (meta.source) ---
    var sendingApp = msg['MSH']['MSH.3']['MSH.3.1'].toString() || "UnknownApp";
    var sendingFacility = msg['MSH']['MSH.4']['MSH.4.1'].toString() || "UnknownFacility";
    var provenanceSource = "urn:source:" + sendingFacility + ":" + sendingApp;

    // --- 2. Patient Identifier Mapping (Find the MRN) ---
    var targetMrn = "";
    var mrnSystemUrl = "urn:oid:1.2.36.146.595.217.0.1"; 

    for (var i = 0; i < msg['PID']['PID.3'].length(); i++) {
        var currentPid3 = msg['PID']['PID.3'][i];
        if (currentPid3['PID.3.5'].toString() === 'MR') {
            targetMrn = currentPid3['PID.3.1'].toString();
            break; 
        }
    }

    // --- 3. Extract Shared OBR Data ---
    var obr = msg['OBR'];
    
    // OBR-24: Category Mapping
    var obr24 = obr['OBR.24']['OBR.24.1'].toString();
    var categoryCode = obr24;
    var categoryDisplay = obr24;
    if (obr24 === "GENLAB") {
        categoryCode = "laboratory";
        categoryDisplay = "Laboratory";
    }

    // OBR-7: Effective Date Formatting (HL7 to FHIR ISO 8601)
    var obr7 = obr['OBR.7']['OBR.7.1'].toString();
    var effectiveDateTime = "";
    if (obr7.length >= 8) {
        effectiveDateTime = obr7.substring(0,4) + "-" + obr7.substring(4,6) + "-" + obr7.substring(6,8);
        if (obr7.length >= 12) {
            effectiveDateTime += "T" + obr7.substring(8,10) + ":" + obr7.substring(10,12) + ":00Z";
        }
    }

    // --- 4. Initialize the FHIR Transaction Bundle ---
    var fhirBundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": []
    };

    // --- 5. Loop Through All OBX Segments ---
    for (var j = 0; j < msg['OBX'].length(); j++) {
        var obx = msg['OBX'][j]; 
        
        // OBX-6 & OBX-7: Reference Range and Units
        var obx6 = obx['OBX.6']['OBX.6.1'].toString();
        var obx7 = obx['OBX.7']['OBX.7.1'].toString();
        var lowVal = "";
        var highVal = "";
        
        if (obx7.indexOf('-') > -1) {
            var rangeParts = obx7.split('-');
            lowVal = rangeParts[0].trim();
            highVal = rangeParts[1].trim();
        }
        
        // OBX-8: Interpretation
        var obx8 = obx['OBX.8']['OBX.8.1'].toString();
        var interpDisplay = obx8;
        if (obx8 === "H") interpDisplay = "High";
        if (obx8 === "L") interpDisplay = "Low";
        if (obx8 === "N") interpDisplay = "Normal";

        // Construct Individual Observation Resource
        var observation = {
            "resourceType": "Observation",
            "meta": {
                "source": provenanceSource
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": categoryCode,
                            "display": categoryDisplay
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": obx['OBX.3']['OBX.3.1'].toString(),
                        "display": obx['OBX.3']['OBX.3.2'].toString() 
                    }
                ],
                "text": obx['OBX.3']['OBX.3.2'].toString() 
            },
            "subject": {
                "identifier": {
                    "system": mrnSystemUrl,
                    "value": targetMrn
                }
            },
            "effectiveDateTime": effectiveDateTime,
            "valueQuantity": {
                "value": parseFloat(obx['OBX.5']['OBX.5.1'].toString()), 
                "unit": obx6 
            },
            "interpretation": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "code": obx8,
                            "display": interpDisplay
                        }
                    ]
                }
            ],
            "referenceRange": [
                {
                    "low": {
                        "value": parseFloat(lowVal),
                        "unit": obx6
                    },
                    "high": {
                        "value": parseFloat(highVal),
                        "unit": obx6
                    },
                    "text": obx7 + " " + obx6
                }
            ]
        };
        
        // Clean up empty objects to prevent FHIR validation errors
        if (!obx8) delete observation.interpretation;
        if (!obx7) delete observation.referenceRange;
        if (!effectiveDateTime) delete observation.effectiveDateTime;
        
        // Add the Observation to the Bundle Array
        fhirBundle.entry.push({
            "resource": observation,
            "request": {
                "method": "POST",
                "url": "Observation"
            }
        });
    }
    
    // --- 6. Finalize Payload ---
    channelMap.put('fhirPayload', JSON.stringify(fhirBundle));
}