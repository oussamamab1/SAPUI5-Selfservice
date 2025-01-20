sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.NewAbsenceRequest", {
      onInit: function () {
        // Session check
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          this._restoreSessionOrGoLogin();
        } else {
          this._continueInit();
        }
      },

      _restoreSessionOrGoLogin: function () {
        var sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
          var userDataString = sessionStorage.getItem(sessionId);
          if (userDataString) {
            try {
              var userData = JSON.parse(userDataString);
              var oSessionModel = new JSONModel(userData);
              sap.ui.getCore().setModel(oSessionModel, "userModel");
              this._continueInit();
              return;
            } catch (e) {
              console.error("Fehler beim Parsen der Session-Daten:", e);
            }
          }
        }
        sap.m.MessageToast.show("Bitte erst einloggen.");
        this.getOwnerComponent().getRouter().navTo("login");
      },

      _continueInit: function () {
        this.byId("urlaubkontingent").setText("Laden..."); //Debug
        this._loadAbwesenheitsart(); 
        this._loadUrlaubkontingent();
        this._loadGenehmigender();
      },

      _loadAbwesenheitsart: function () {
        const that = this;
        firebase.db
          .collection("Abwesenheitsart")
          .get()
          .then((querySnapshot) => {
            const abwesenheitart = querySnapshot.docs.map((doc) => doc.data());
            const oModel = new sap.ui.model.json.JSONModel({
              Abwesenheitsart: abwesenheitart,
            });
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
        var urlaubkontingentField = this.byId("urlaubkontingent");
        let defaultKontingent = 20; 
      
        firebase.db
          .collection("StelleRolle")
          .where("Mitarbeiter-ID", "==", mitarbeiterId)
          .get()
          .then((querySnapshot) => {
            let faktor = 1; 
            if (!querySnapshot.empty) {
              querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.Faktor === 0.5 || data.Faktor === 1) {
                  faktor = data.Faktor;
                } else {
                  console.log("Unexpected Faktor value:", data.Faktor);
                }
              });
            } else {
              console.log("No documents found for Mitarbeiter-ID:", mitarbeiterId);
            }
      
            // Set Urlaubkontingent based on Faktor
            defaultKontingent = faktor === 0.5 ? 10 : 20;
            urlaubkontingentField.setText(defaultKontingent);
      
            return firebase.db
              .collection("Urlaubsplan")
              .where("Mitarbeiter-ID", "==", mitarbeiterId)
              .where("Status", "==", "Genehmigt")
              .get();
          })
          .then((querySnapshot) => {
            if (querySnapshot.empty) {
                console.log("No approved Urlaubsplan found. Using default kontingent.");
                return;
            }
        
            const seineurlaubsplan = querySnapshot.docs.map((doc) => doc.data());
            let totalPlannedDays = 0;
        
            seineurlaubsplan.forEach((plan) => {
                const geplanteTage = parseFloat(plan.geplanterUrlaubstage || 0);
                if (!isNaN(geplanteTage)) {
                    totalPlannedDays += geplanteTage;
                } else {
                    console.warn("Invalid geplanteTage in plan:", plan);
                }
            });
        
            const urlaubkontingent = parseFloat(defaultKontingent);
            const verbleibenderUrlaub = urlaubkontingent - totalPlannedDays;
        
            console.log(`Total planned days: ${totalPlannedDays}`);
            urlaubkontingentField.setText(
                !isNaN(verbleibenderUrlaub) ? verbleibenderUrlaub.toString() : urlaubkontingent
            );
        })        
          .catch((error) => {
            console.error("Error fetching UrlaubKontingent:", error);
            urlaubkontingentField.setText(20); // Default fallback on error
          });
      },

      _loadGenehmigender: function () {
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }
      
        var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
        var stellenId = oUserModel.getProperty("/Stellen-ID");
        var abteilungId = oUserModel.getProperty("/Abteilung-ID");
      
        if (!abteilungId || !mitarbeiterId || !stellenId) {
          console.error("Required user data is missing!");
          return;
        }
        firebase.db
          .collection("Abteilung")
          .where("Abteilung-ID", "==", abteilungId)
          .get()
          .then((querySnapshot) => {
            if (!querySnapshot.empty) {
              const abteilungsleiterId = querySnapshot.docs[0].data()["Abteilungsleiter-ID"];
      
              if (!abteilungsleiterId) {
                console.error("No Abteilungsleiter-ID found for Abteilung-ID:", abteilungId);
                return Promise.reject("No Abteilungsleiter-ID found.");
              }
      
              return firebase.db
                .collection("DatenZurPerson")
                .where("Mitarbeiter-ID", "==", abteilungsleiterId)
                .get();
            } else {
              console.error("No documents found for Abteilung-ID:", abteilungId);
              return Promise.reject("No documents found.");
            }
          })
          .then((querySnapshot) => {
            if (!querySnapshot.empty) {
              // if (stellenId === "S001" || mitarbeiterId === abteilungsleiterId) {
              //   const approverInput = this.byId("approverInput");
              //   if (approverInput) {
              //     approverInput.setValue("CEO");
              //   } else {
              //     console.error("approverInput element not found!");
              //   }
              //   return; 
              // }
              const mitarbeiterData = querySnapshot.docs[0].data();
              console.log(mitarbeiterData);
              const name = mitarbeiterData.Vorname + " " + mitarbeiterData.Nachname;
      
              const approverInput = this.byId("approverInput");
              if (approverInput) {
                approverInput.setValue(name);
              } else {
                console.error("approverInput element not found!");
              }
            } else {
              console.error("No documents found in DatenzurPerson for Abteilungsleiter-ID.");
            }
          })
          .catch((error) => {
            console.error("Error fetching approver details:", error);
          });
      },      
      
      clearInputFields: function (controlIds) {
        const oView = this.getView();
        controlIds.forEach((controlId) => {
          const control = oView.byId(controlId);
          if (control) {
            if (control.setValue) {
              control.setValue("");
            }
            if (control.setSelected) {
              control.setSelected(false);
            }
          }
        });
      },

      onradioButtonChange: function (oEvent) {
        const selectedIndex = oEvent.getParameter("selectedIndex");
        const selectedRadioButton =
          selectedIndex === 0 ? "moreThanOneDay" : "oneDayOrLess";
        this.getView()
          .getModel()
          .setProperty("/selectedRadioButton", selectedRadioButton);
        this.clearInputFields([
          "datepicker",
          "beginnTimePicker",
          "endTimePicker",
          "durationInput",
          "Zeitraum",
          "durationTagInput",
          "noteTextArea",
        ]);
      },

      onDateChange: function (oEvent) {
        const oSource = oEvent.getSource();
        const sSourceId = oSource.getId();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (sSourceId.includes("Zeitraum")) {
          const oStartDate = oSource.getDateValue();
          const oEndDate = oSource.getSecondDateValue();
          if (oStartDate && oEndDate) {
            if (oStartDate <= today || oEndDate <= today) {
              oSource.setValueState("Error");
              this.byId("Savebutton").setEnabled(false);
              oSource.setValueStateText("Datum muss ab morgen gewählt werden.");
              this.byId("durationTagInput").setValue("");
          } else {
              oSource.setValueState("None");
              this.byId("Savebutton").setEnabled(true);
              const iDuration = this.calculateWeekdays(oStartDate, oEndDate);
              this.byId("durationTagInput").setValue(iDuration);
          }
          } else {
              this.byId("durationTagInput").setValue("");
          }
      } else if (sSourceId.includes("datepicker")) {
          const selectedDate = oSource.getDateValue();
          const absenceType = this.getView().byId("absenceTypeSelect").getSelectedItem()?.getText();
          
          if (selectedDate) {
              const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
              let isValid = true;
              let errorMessage = "";
              if (selectedDate <= today) {
                  isValid = false;
                 errorMessage = "Datum muss ab morgen gewählt werden.";
                  this.byId("Savebutton").setEnabled(false);
              }

              if (isValid && absenceType) {
                  if (absenceType === "Teleworking Wochenende") {
                      isValid = dayOfWeek === 0 || dayOfWeek === 6;
                      if (!isValid) {
                        errorMessage = "Für Teleworking Wochenende bitte Samstag oder Sonntag wählen.";
                    }
                  } else if (absenceType === "Teleworking") {
                      isValid = dayOfWeek >= 1 && dayOfWeek <= 5;
                      if (!isValid) {
                        errorMessage = "Für Teleworking bitte Montag bis Freitag wählen.";
                    }
                  } else if (absenceType === "Urlaub") {
                      isValid = dayOfWeek >= 1 && dayOfWeek <= 5;
                      if (!isValid) {
                        errorMessage = "Für Urlaub bitte Montag bis Freitag wählen.";
                    }
                  }
              }

              if (isValid) {
                oSource.setValueState("None");
                this.byId("Savebutton").setEnabled(true);
              } else {
                  oSource.setValueState("Error");
                  oSource.setValueStateText(errorMessage);
                  this.byId("Savebutton").setEnabled(false);
              }
            }
        }
      },

      calculateWeekdays: function (startDate, endDate) {
        let weekdaysCount = 0;
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
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

            if (
              isNaN(startHours) ||
              isNaN(startMinutes) ||
              isNaN(endHours) ||
              isNaN(endMinutes)
            ) {
              throw new Error("Ungültiges Zeitformat.");
            }

            var oBeginnTime = new Date();
            var oEndTime = new Date();

            oBeginnTime.setHours(startHours, startMinutes, 0, 0);
            oEndTime.setHours(endHours, endMinutes, 0, 0);

            if (oEndTime < oBeginnTime) {
              MessageToast.show(
                "Endzeit kann nicht vor der Beginnzeit liegen."
              );
              return;
            }

            var duration = (oEndTime - oBeginnTime) / (1000 * 60 * 60);
            this.byId("durationInput").setValue(duration.toFixed(2));
          } catch (error) {
            MessageToast.show(
              error.message || "Fehler bei der Berechnung der Dauer."
            );
            console.error(error.message);
          }
        } else {
          MessageToast.show("Bitte sowohl Beginn- als auch Endzeit eingeben.");
        }
      },
     
      onAbsenceTypeChange: function () {
        var oView = this.getView();
        var oSelectedType = oView.byId("absenceTypeSelect").getSelectedItem();
        var oRadioButtonGroup = oView.byId("radiobuttonsgroup");
        var aRadioButtons = oRadioButtonGroup.getButtons();

        var inputFields = [
          "datepicker",
          "beginnTimePicker",
          "endTimePicker",
          "durationInput",
          "durationTagInput",
          "Zeitraum",
          "noteTextArea"
        ];
      
        // Clear the input fields 
        this.clearInputFields(inputFields);
    
        if (oSelectedType && oSelectedType.getText() !== "Urlaub") {
            // Disable the "Mehr als ein Tag" option
            aRadioButtons[0].setEnabled(false); 
            oRadioButtonGroup.setSelectedIndex(1); 
            oView.getModel().setProperty("/selectedRadioButton", "oneDayOrLess");
        } else {
            // Enable both options for "Urlaub"
            aRadioButtons[0].setEnabled(true); 
            oRadioButtonGroup.setSelectedIndex(0);
            oView.getModel().setProperty("/selectedRadioButton", "moreThanOneDay");
        }
      },
    
      onSaveRequest: function () {
        var oView = this.getView();
        var oUserModel = sap.ui.getCore().getModel("userModel");

        if (!oUserModel) {
          sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }

        var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");

        // Tarif
        var tarif = 1;
        firebase.db
          .collection("StelleRolle")
          .where("Mitarbeiter-ID", "==", mitarbeiterId) 
          .get()
          .then((querySnapshot) => {
            if (!querySnapshot.empty) {
              querySnapshot.forEach((doc) => {
                const data = doc.data();
                const faktor = data.Faktor; 
                if (faktor === 0.5 || faktor === 1) {
                  tarif = faktor;
                  console.log("Tarif is set to:", tarif);
                  return tarif;
                } else {
                  console.log("Unexpected Faktor value:", faktor);
                }
              });
            } else {
              console.log("No documents found for Mitarbeiter-ID:", mitarbeiterId);
            }
          })
          .catch((error) => {
            console.error("Error querying StelleRolle collection:", error);
        });

        var anstragdatum = new Date();
        var oSelectedType = oView.byId("absenceTypeSelect").getSelectedItem();
        var sDate = oView.byId("datepicker").getValue();
        var sZeitraum = oView.byId("Zeitraum").getValue();
        var oStartDate = oView.byId("Zeitraum").getDateValue();
        var oEndDate = oView.byId("Zeitraum").getSecondDateValue();
        var sStartTime = oView.byId("beginnTimePicker").getValue();
        var sEndTime = oView.byId("endTimePicker").getValue();
        var calculatedDays = oView.byId("durationTagInput").getValue();
        var calculatedHours = oView.byId("durationInput").getValue();
        var urlaubkontingent = Number(oView.byId("urlaubkontingent").getText());
        var sNote = oView.byId("noteTextArea").getValue();

        if (
          !oSelectedType ||
          (!sZeitraum && (!sDate || !sStartTime || !sEndTime))
        ) {
          MessageToast.show("Bitte alle erforderlichen Felder ausfüllen!");
          return;
        }

        let parsedDate;
        if (!sZeitraum && sDate) {
          const parts = sDate.split("/");
          if (parts.length === 3) {
            const [day, month, year] = parts.map(Number);
            parsedDate = new Date(
              `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
                2,
                "0"
              )}`
            );
            if (isNaN(parsedDate.getTime())) {
              MessageToast.show(
                "Ungültiges Datum. Bitte überprüfen Sie die Eingabe."
              );
              return;
            }
          }
        }

        const absenceType = oSelectedType.getText();

        // Check Urlaub Kontingent
        if (absenceType === "Urlaub" && calculatedDays > urlaubkontingent) {
          MessageToast.show(
            `Ihr Urlaubskontingent reicht nicht aus. Verfügbare Tage: ${urlaubkontingent}`
          );
          return;
        }

        const startOfDay = new Date(anstragdatum).setHours(0, 0, 0, 0);
        const endOfDay = new Date(anstragdatum).setHours(23, 59, 59, 999);

        const collectionName =
          absenceType === "Urlaub" ? "Urlaubsplan" : "Abwesenheiten";
        const type = absenceType === "Urlaub" ? "Urlaub" : "Teleworking";

        // Handle Firebase Request
        firebase.db
          .collection(collectionName)
          .where("Mitarbeiter-ID", "==", mitarbeiterId)
          .where(
            "Antragsdatum",
            ">=",
            firebase.Timestamp.fromDate(new Date(startOfDay))
          )
          .where(
            "Antragsdatum",
            "<=",
            firebase.Timestamp.fromDate(new Date(endOfDay))
          )
          .get()
          .then((querySnapshot) => {
            const seineurlaubsplan = querySnapshot.docs.map((doc) =>
              doc.data()
            );
            const formattedDate = `${anstragdatum.getFullYear()}-${String(
              anstragdatum.getMonth() + 1
            ).padStart(2, "0")}-${String(anstragdatum.getDate()).padStart(
              2,
              "0"
            )}`;
            const docID = `${formattedDate}_${
              seineurlaubsplan.length + 1
            }_${mitarbeiterId}`;

            // Prepare Request Data
            const requestData = {
              Antragsdatum: anstragdatum,
              "Mitarbeiter-ID": mitarbeiterId,
              "Abwesenheit-ID": oSelectedType.getKey(),
              Kommentare: sNote,
              Status: "In Bearbeitung",
              ...(type === "Urlaub" &&
                sDate && {
                  UrlaubKontingent: urlaubkontingent,
                  geplanterUrlaubstage: tarif == 1 ? (calculatedHours > 4 ? 1 : 0.5) : 1,
                }),
              ...(type === "Teleworking" && {
                  Arbeitstunden: calculatedHours,
                }),
              ...(sZeitraum
                ? {
                    Startdatum: oStartDate,
                    Enddatum: oEndDate,
                    UrlaubKontingent: urlaubkontingent,
                    geplanterUrlaubstage: calculatedDays,
                  }
                : {
                    Datum: firebase.Timestamp.fromDate(parsedDate),
                    Startzeit: sStartTime,
                    Endzeit: sEndTime,
                  }),
            };

            return firebase.db
              .collection(collectionName)
              .doc(docID)
              .set(requestData)
              .then(() => {
                MessageToast.show(
                  `${absenceType} erfolgreich beantragt. ${
                    absenceType === "Urlaub"
                      ? `Verbraucht: ${calculatedDays} Tage.`
                      : ""
                  }`
                );
                sap.ui.core.UIComponent.getRouterFor(this).navTo("absenceOverview");
              });
          })
          .catch((error) => {
            console.error(
              `Fehler beim Speichern des ${collectionName}:`,
              error
            );
            MessageToast.show(`Fehler beim Speichern des ${collectionName}.`);
          });
      },

      onCancelRequest: function () {
        try {
          this.clearInputFields([
            "datepicker",
            "beginnTimePicker",
            "endTimePicker",
            "durationInput",
            "Zeitraum",
            "durationTagInput",
            "noteTextArea",
          ]);
          var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("absenceOverview");
        } catch (e) {
          console.error("Fehler bei der Navigation zurück:", e);
          sap.m.MessageToast.show("Fehler bei der Navigation.");
        }
      },
    });
  }
);
