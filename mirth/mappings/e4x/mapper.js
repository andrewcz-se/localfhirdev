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

    // OBR-7: Effective Date
    var obr7 = obr['OBR.7']['OBR.7.1'].toString();
    var effectiveDateTime = "";
    if (obr7.length >= 8) {
        effectiveDateTime = obr7.substring(0,4) + "-" + obr7.substring(4,6) + "-" + obr7.substring(6,8);
        if (obr7.length >= 12) {
            effectiveDateTime += "T" + obr7.substring(8,10) + ":" + obr7.substring(10,12) + ":00Z";
        }
    }
    
    // OBR-2: Order Number (Used for ID Generation)
    var orderNum = obr['OBR.2']['OBR.2.1'].toString();
    if (!orderNum) {
        orderNum = obr['OBR.3']['OBR.3.1'].toString(); // Fallback to Filler Order Number
    }

    // OBR-25: Result Status Mapping
    var obr25 = obr['OBR.25']['OBR.25.1'].toString();
    var fhirStatus = "final"; // Safe default
    if (obr25 === "P") fhirStatus = "preliminary";
    if (obr25 === "C") fhirStatus = "corrected";
    if (obr25 === "F") fhirStatus = "final";

    // --- 4. Initialize the FHIR Transaction Bundle ---
    var fhirBundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": []
    };

    // --- 5. Loop Through All OBX Segments ---
    for (var j = 0; j < msg['OBX'].length(); j++) {
        var obx = msg['OBX'][j]; 
        
        // --- 5a. Deterministic ID Generation ---
        var loincCode = obx['OBX.3']['OBX.3.1'].toString();
        var rawObservationId = orderNum + "-" + loincCode;
        var safeObservationId = rawObservationId.replace(/[^A-Za-z0-9\-\.]/g, '');
        
        // --- 5b. Extract OBX-Specific NTE Segments (Notes) ---
        var nteNotes = [];
        var obxIndex = obx.childIndex(); 
        
        for (var k = obxIndex + 1; k < msg.children().length(); k++) {
            var nextSegment = msg.children()[k];
            if (nextSegment.name().toString() === 'NTE') {
                var comment = nextSegment['NTE.3']['NTE.3.1'].toString();
                if (comment) {
                    nteNotes.push(comment);
                }
            } else {
                break; 
            }
        }
        
        // --- 5c. Extract Standard OBX Data ---
        var obx6 = obx['OBX.6']['OBX.6.1'].toString();
        var obx7 = obx['OBX.7']['OBX.7.1'].toString();
        var lowVal = "";
        var highVal = "";
        
        if (obx7.indexOf('-') > -1) {
            var rangeParts = obx7.split('-');
            lowVal = rangeParts[0].trim();
            highVal = rangeParts[1].trim();
        }
        
        var obx8 = obx['OBX.8']['OBX.8.1'].toString();
        var interpDisplay = obx8;
        if (obx8 === "H") interpDisplay = "High";
        if (obx8 === "L") interpDisplay = "Low";
        if (obx8 === "N") interpDisplay = "Normal";

        // Construct Individual Observation Resource
        var observation = {
            "resourceType": "Observation",
            "id": safeObservationId, 
            "meta": {
                "source": provenanceSource
            },
            "status": fhirStatus, // Injected dynamic status
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
                        "code": loincCode,
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
            "performer": [
                {
                    "display": sendingFacility 
                }
            ],
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
        
        // --- 5d. Append Notes (If Any) ---
        if (nteNotes.length > 0) {
            observation.note = [];
            for (var n = 0; n < nteNotes.length; n++) {
                observation.note.push({
                    "text": nteNotes[n]
                });
            }
        }
        
        // Clean up empty objects
        if (!obx8) delete observation.interpretation;
        if (!obx7) delete observation.referenceRange;
        if (!effectiveDateTime) delete observation.effectiveDateTime;
        
        // Add the Observation to the Bundle Array using PUT logic
        fhirBundle.entry.push({
            "resource": observation,
            "request": {
                "method": "PUT",
                "url": "Observation/" + safeObservationId 
            }
        });
    }
    
    // --- 6. Finalize Payload ---
    channelMap.put('fhirPayload', JSON.stringify(fhirBundle));
}