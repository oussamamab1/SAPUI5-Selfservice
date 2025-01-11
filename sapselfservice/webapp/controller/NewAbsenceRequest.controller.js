sap.ui.define(
    ['sap/ui/core/mvc/Controller', 'sap/m/MessageToast', 'sap/ui/core/UIComponent', "sapselfservice/backend/firebase"],
    function (Controller, MessageToast, UIComponent, firebase) {
        'use strict';

        return Controller.extend('sapselfservice.controller.NewAbsenceRequest', {
            onInit: function () {
                this.byId("urlaubkontingent").setText("Laden...");
                this._loadAbwesenheitsart();
                this._loadUrlaubkontingent();
            },
            
            _loadAbwesenheitsart: function () {
                const that=this;
                firebase.db.collection("Abwesenheitsart")
                    .get()
                    .then((querySnapshot) => {
                        const abwesenheitart = querySnapshot.docs.map((doc) => doc.data());
                        const oModel = new sap.ui.model.json.JSONModel({ Abwesenheitsart: abwesenheitart });
                        that.getView().setModel(oModel);
                    })
                    .catch((error) => {
                        console.error("Fehler beim Abrufen der Abwesenheitsarten: ", error);
                    });
            },
            

            _loadUrlaubkontingent: function () {
                console.log("Loading Urlaubkontingent...");
                var oUserModel = sap.ui.getCore().getModel("userModel");
                if (!oUserModel) {
                    sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
                    this.getOwnerComponent().getRouter().navTo("login");
                    return;
                }
            
                var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
                console.log("Querying Firestore for Mitarbeiter-ID:", mitarbeiterId); 
                if (!mitarbeiterId) {
                    console.error("Mitarbeiter-ID is not set or invalid!");
                    return;
                }
                const urlaubkontingentField = this.byId("urlaubkontingent");

                firebase.db
                    .collection("Urlaubsplan")
                    .where("Mitarbeiter-ID", "==", mitarbeiterId)
                    .where("Status", "==", "Genehmigt")
                    .get()
                    .then((querySnapshot) => {
                        console.log("Query snapshot:", querySnapshot);
                        if (querySnapshot.empty) {
                            urlaubkontingentField.setText(20); // Standardwert
                            return;
                        }
            
                        const seineurlaubsplan = querySnapshot.docs.map((doc) => doc.data());
                        const neuesterUrlaubsplan = seineurlaubsplan.sort((a, b) => {
                            const dateA = new Date(a.Antragsdatum).getTime();
                            const dateB = new Date(b.Antragsdatum).getTime();
                            return dateB - dateA;
                        })[0];
            
                        const urlaubkontingent = parseFloat(neuesterUrlaubsplan?.UrlaubKontingent || 0);
                        const geplanterUrlaubstage = parseFloat(neuesterUrlaubsplan?.geplanterUrlaubstage || 0);
                        const verbleibenderUrlaub = urlaubkontingent - geplanterUrlaubstage;

                        urlaubkontingentField.setText(!isNaN(verbleibenderUrlaub) ? verbleibenderUrlaub : 20);
                    }).catch((error) => {
                        console.error("Error fetching UrlaubKontingent:", error);
                        this.byId("urlaubkontingent").setText(20); // Default fallback on error
                    });
            },
            
            
            clearInputFields: function (controlIds) {
                const oView = this.getView();
                controlIds.forEach((controlId) => {
                    const control = oView.byId(controlId);
                    if (control) {
                        if (control.setValue) {
                            control.setValue(""); // Clear input value (e.g., DatePicker, Input)
                        }
                        if (control.setSelected) {
                            control.setSelected(false); // Clear selection (e.g., CheckBox)
                        }
                    } else {
                        console.warn(`Control with ID ${controlId} not found.`);
                    }
                });
            },            
            
            onradioButtonChange: function (oEvent) {
                const selectedIndex = oEvent.getParameter("selectedIndex");
                const selectedRadioButton = selectedIndex === 0 ? "moreThanOneDay" : "oneDayOrLess";
                this.getView().getModel().setProperty("/selectedRadioButton", selectedRadioButton);
                this.clearInputFields([
                    "datepicker",        
                    "beginnTimePicker",  
                    "endTimePicker",    
                    "durationInput",     
                    "Zeitraum",         
                    "durationTagInput",  
                    "approverInput",     
                    "noteTextArea"      
                ]);
            },
            

            onDateChange: function (oEvent) {
                const oSource = oEvent.getSource();
                const sSourceId = oSource.getId();
                if (sSourceId.includes("Zeitraum")) {
                    // Handle the case for "Mehr als ein Tag"
                    const oStartDate = oSource.getDateValue(); 
                    const oEndDate = oSource.getSecondDateValue(); 
            
                    if (oStartDate && oEndDate) {
                        const iDuration = this.calculateWeekdays(oStartDate, oEndDate);
                        console.log("Dauer in Tagen:", iDuration);
                        this.byId("durationTagInput").setValue(iDuration);
                    } else {
                        this.byId("durationTagInput").setValue("");
                    }
                }
            },
            
            calculateWeekdays: function (startDate, endDate) {
                let weekdaysCount = 0;
                const currentDate = new Date(startDate);
            
                while (currentDate <= endDate) {
                    const dayOfWeek = currentDate.getDay();
                    // 0 = Sunday, 6 = Saturday
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        weekdaysCount++;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return weekdaysCount;
            },

            onTimeChange: function () {
                const sBeginnTime = this.byId("beginnTimePicker").getValue();
                const sEndTime = this.byId("endTimePicker").getValue();
        
                if (sBeginnTime && sEndTime) {
                    try {
                        var [startHours, startMinutes] = sBeginnTime.split(":").map(Number);
                        var [endHours, endMinutes] = sEndTime.split(":").map(Number);
            
                        if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
                            throw new Error("Ungültiges Zeitformat.");
                        }
            
                        var oBeginnTime = new Date();
                        var oEndTime = new Date();
            
                        oBeginnTime.setHours(startHours, startMinutes, 0, 0);
                        oEndTime.setHours(endHours, endMinutes, 0, 0);
            
                        if (isNaN(oBeginnTime.getTime()) || isNaN(oEndTime.getTime())) {
                            throw new Error("Fehler beim Erstellen der Zeiten.");
                        }
            
                        console.log("Beginnzeit:", oBeginnTime);
                        console.log("Endzeit:", oEndTime);
            
                        if (oEndTime < oBeginnTime) {
                            MessageToast.show("Endzeit kann nicht vor der Beginnzeit liegen.");
                            console.error("Fehler: Endzeit ist vor Beginnzeit.");
                            return;
                        }
            
                        var duration = (oEndTime - oBeginnTime) / (1000 * 60 * 60);
                        console.log("Dauer in Stunden:", duration);
            
                        this.byId("durationInput").setValue(duration.toFixed(2));
                    } catch (error) {
                        MessageToast.show(error.message || "Fehler bei der Berechnung der Dauer.");
                        console.error(error.message);
                    }
                } else {
                    MessageToast.show("Bitte sowohl Beginn- als auch Endzeit eingeben.");
                    console.error("Fehlende Werte in Beginn- oder Endzeit.");
                }
            },
                  

            onSaveRequest: function () {
                const oView = this.getView();
                const oUserModel = sap.ui.getCore().getModel("userModel");
            
                // Check user model
                if (!oUserModel) {
                    sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
                    this.getOwnerComponent().getRouter().navTo("login");
                    return;
                }
            
                const mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
                const anstragdatum = new Date();
            
                const oSelectedType = oView.byId("absenceTypeSelect").getSelectedItem();
                const sDate = oView.byId("datepicker").getValue();
                const sZeitraum = oView.byId("Zeitraum").getValue();
                const oStartDate = oView.byId("Zeitraum").getDateValue();
                const oEndDate = oView.byId("Zeitraum").getSecondDateValue();
                const sStartTime = oView.byId("beginnTimePicker").getValue();
                const sEndTime = oView.byId("endTimePicker").getValue();
                const calculatedDays = oView.byId("durationTagInput").getValue();
                const calculatedHours = oView.byId("durationInput").getValue();
                const urlaubkontingent = Number(oView.byId("urlaubkontingent").getText());
                const sNote = oView.byId("noteTextArea").getValue();
            
                if (!oSelectedType || 
                    (!sZeitraum && (!sDate || !sStartTime || !sEndTime))) {
                    MessageToast.show("Bitte alle erforderlichen Felder ausfüllen!");
                    return;
                }

                let parsedDate;
                if (!sZeitraum && sDate) {
                    const [day, month, year] = sDate.split("/").map(Number);
                    parsedDate = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

                    if (isNaN(parsedDate.getTime())) {
                        console.error("Invalid sDate value:", sDate);
                        MessageToast.show("Ungültiges Datum. Bitte überprüfen Sie die Eingabe.");
                        return;
                    }
                }
                const absenceType = oSelectedType.getText();
            
                // Validate Absence Type
                const chosenDay = new Date(sDate.split(".").reverse().join("-")).getDay(); // 0 = Sunday, 6 = Saturday
                if (absenceType === "Teleworking" && (chosenDay === 0 || chosenDay === 6)) {
                    MessageToast.show("Für Wochenendarbeit bitte 'Teleworking Wochenende' auswählen.");
                    return;
                }
                if (absenceType === "Teleworking (Wochenende)" && (chosenDay !== 0 && chosenDay !== 6)) {
                    MessageToast.show("Für Wochentagsarbeit bitte 'Teleworking' auswählen.");
                    return;
                }
            
                // Check Urlaub Kontingent
                if (absenceType === "Urlaub" && calculatedDays > urlaubkontingent) {
                    MessageToast.show(`Ihr Urlaubskontingent reicht nicht aus. Verfügbare Tage: ${urlaubkontingent}`);
                    return;
                }
            
                const startOfDay = new Date(anstragdatum).setHours(0, 0, 0, 0);
                const endOfDay = new Date(anstragdatum).setHours(23, 59, 59, 999);
            
                const collectionName = absenceType === "Urlaub" ? "Urlaubsplan" : "Abwesenheiten";
                const type = absenceType === "Urlaub" ? "Urlaub" : "Teleworking";
            
                // Handle Firebase Request
                firebase.db
                    .collection(collectionName)
                    .where("Mitarbeiter-ID", "==", mitarbeiterId)
                    .where("Antragsdatum", ">=", firebase.Timestamp.fromDate(new Date(startOfDay)))
                    .where("Antragsdatum", "<=", firebase.Timestamp.fromDate(new Date(endOfDay)))
                    .get()
                    .then((querySnapshot) => {
                        const seineurlaubsplan = querySnapshot.docs.map((doc) => doc.data());
                        const formattedDate = `${anstragdatum.getFullYear()}-${String(anstragdatum.getMonth() + 1).padStart(2, "0")}-${String(anstragdatum.getDate()).padStart(2, "0")}`;
                        const docID = `${formattedDate}_${seineurlaubsplan.length + 1}_${mitarbeiterId}`;
            
                        // Prepare Request Data
                        const requestData = {
                            "Antragsdatum": anstragdatum,
                            "Mitarbeiter-ID": mitarbeiterId,
                            "Abwesenheit-ID": oSelectedType.getKey(),
                            "Kommentare": sNote,
                            "Status": "In Bearbeitung",
                            ...(type === "Urlaub" && sZeitraum && {
                                "UrlaubKontingent": urlaubkontingent,
                                "geplanterUrlaubstage": calculatedDays,
                            }),
                            ...(type === "Urlaub" && sDate && {
                                "UrlaubKontingent": urlaubkontingent,
                                "geplanterUrlaubstage": calculatedHours > 4 ? 1 : 0.5,
                            }),
                            ...(type === "Teleworking" && sZeitraum && {
                                "geplanterArbeitstage": calculatedDays,
                            }),
                            ...(type === "Teleworking" && sDate && {
                                "Arbeitstunden": calculatedHours,
                            }),
                            ...(sZeitraum ? 
                                {
                                    "Startdatum": oStartDate,
                                    "Enddatum": oEndDate,
                                }
                                : {
                                    "Datum": firebase.Timestamp.fromDate(parsedDate),
                                    "Startzeit": sStartTime,
                                    "Endzeit": sEndTime,
                                }),
                        };
            
                        return firebase.db
                            .collection(collectionName)
                            .doc(docID)
                            .set(requestData)
                            .then(() => {
                                MessageToast.show(
                                    `${absenceType} erfolgreich beantragt. ${
                                        absenceType === "Urlaub" ? `Verbraucht: ${calculatedDays} Tage.` : ""
                                    }`
                                );
                            });
                    })
                    .catch((error) => {
                        console.error(`Fehler beim Speichern des ${collectionName}:`, error);
                        MessageToast.show(`Fehler beim Speichern des ${collectionName}.`);
                    });
            },
            
            
            onCancelRequest: function () {
                try {
                    var oView = this.getView();
                    this.clearInputFields([
                        "datepicker",        
                        "beginnTimePicker",  
                        "endTimePicker",    
                        "durationInput",     
                        "Zeitraum",         
                        "durationTagInput",  
                        "approverInput",     
                        "noteTextArea"      
                    ]);
                    var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                    oRouter.navTo('absenceOverview'); // Navigiere zurück zur Startseite
                    console.log('geklickt');
                } catch (e) {
                    console.error('Fehler bei der Navigation zurück:', e);
                    MessageToast.show('Fehler bei der Navigation.');
                }
            }
        });
    }
);
