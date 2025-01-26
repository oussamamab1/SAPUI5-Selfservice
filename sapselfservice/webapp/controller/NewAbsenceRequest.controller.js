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
        this.byId("urlaubkontingent").setText("Laden...");
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
            }

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
              return;
            }

            const seineurlaubsplan = querySnapshot.docs.map((doc) =>
              doc.data()
            );
            let totalPlannedDays = 0;

            seineurlaubsplan.forEach((plan) => {
              const geplanteTage = parseFloat(plan.geplanterUrlaubstage || 0);
              if (!isNaN(geplanteTage)) {
                totalPlannedDays += geplanteTage;
              }
            });

            const urlaubkontingent = parseFloat(defaultKontingent);
            const verbleibenderUrlaub = urlaubkontingent - totalPlannedDays;

            urlaubkontingentField.setText(
              !isNaN(verbleibenderUrlaub)
                ? verbleibenderUrlaub.toString()
                : urlaubkontingent
            );
          })
          .catch((error) => {
            console.error("Error fetching UrlaubKontingent:", error);
            urlaubkontingentField.setText(20);
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
        var abteilungId = oUserModel.getProperty("/Abteilung-ID");

        if (!abteilungId || !mitarbeiterId) {
          return;
        }

        const approverInput = this.byId("approverInput");
        if (!approverInput) {
          return;
        }

        firebase.db
          .collection("Abteilung")
          .where("Abteilung-ID", "==", abteilungId)
          .get()
          .then((querySnapshot) => {
            if (querySnapshot.empty) {
              approverInput.setValue("CEO");
              return Promise.reject("No Abteilung found.");
            }

            const abteilungsleiterId =
              querySnapshot.docs[0].data()["Abteilungsleiter-ID"];

            if (!abteilungsleiterId || abteilungsleiterId === mitarbeiterId) {
              approverInput.setValue("CEO");
              return Promise.reject("No specific approver needed.");
            }

            return firebase.db
              .collection("DatenZurPerson")
              .where("Mitarbeiter-ID", "==", abteilungsleiterId)
              .get();
          })
          .then((querySnapshot) => {
            if (querySnapshot.empty) {
              approverInput.setValue("CEO");
              return;
            }

            const mitarbeiterData = querySnapshot.docs[0].data();
            const name =
              mitarbeiterData.Vorname + " " + mitarbeiterData.Nachname;

            approverInput.setValue(name);
          })
          .catch((error) => {
            if (error !== "No specific approver needed.") {
              console.error("Error fetching approver details:", error);
            }
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
            if (oStartDate < today || oEndDate < today) {
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
          const absenceType = this.getView()
            .byId("absenceTypeSelect")
            .getSelectedItem()
            ?.getText();

          if (selectedDate) {
            const dayOfWeek = selectedDate.getDay();
            let isValid = true;
            let errorMessage = "";

            if (absenceType === "Teleworking Wochenende") {
              isValid = dayOfWeek === 6 || dayOfWeek === 0;
              if (!isValid) {
                errorMessage =
                  "Für Teleworking Wochenende bitte Samstag oder Sonntag wählen.";
              }
            } else if (absenceType === "Teleworking") {
              isValid = dayOfWeek >= 1 && dayOfWeek <= 5;
              if (!isValid) {
                errorMessage =
                  "Für Teleworking bitte Montag bis Freitag wählen.";
              }
            } else if (absenceType === "Urlaub") {
              if (selectedDate <= today) {
                isValid = false;
                errorMessage = "Datum muss ab morgen gewählt werden.";
              } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                isValid = false;
                errorMessage = "Für Urlaub bitte Montag bis Freitag wählen.";
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
          "noteTextArea",
        ];

        this.clearInputFields(inputFields);

        var oDatePicker = oView.byId("datepicker");
        if (oDatePicker) {
          oDatePicker.setValueState("None");
          oDatePicker.setValueStateText("");
        }

        var oSaveButton = oView.byId("Savebutton");
        if (oSaveButton) {
          oSaveButton.setEnabled(true);
        }

        if (oSelectedType && oSelectedType.getText() !== "Urlaub") {
          aRadioButtons[0].setEnabled(false);
          oRadioButtonGroup.setSelectedIndex(1);
          oView.getModel().setProperty("/selectedRadioButton", "oneDayOrLess");
        } else {
          aRadioButtons[0].setEnabled(true);
          oRadioButtonGroup.setSelectedIndex(0);
          oView
            .getModel()
            .setProperty("/selectedRadioButton", "moreThanOneDay");
        }
      },

      onSaveRequest: function () {
        const oView = this.getView();
        const oUserModel = sap.ui.getCore().getModel("userModel");

        if (!oUserModel) {
          sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }

        const mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
        const oSelectedType = oView.byId("absenceTypeSelect").getSelectedItem();
        if (!oSelectedType) {
          MessageToast.show("Bitte Abwesenheitstyp auswählen!");
          return;
        }

        const absenceTypeText = oSelectedType.getText();
        const absenceTypeKey = oSelectedType.getKey();

        const oOneDayDate = this.byId("datepicker").getDateValue();
        const sStartTime = this.byId("beginnTimePicker").getValue();
        const sEndTime = this.byId("endTimePicker").getValue();
        const sHours = this.byId("durationInput").getValue();

        const oStartDate = this.byId("Zeitraum").getDateValue();
        const oEndDate = this.byId("Zeitraum").getSecondDateValue();
        const sDurationDays = this.byId("durationTagInput").getValue();

        const sNote = this.byId("noteTextArea").getValue();
        const urlaubkontingent = Number(
          this.byId("urlaubkontingent").getText()
        );
        const selectedRadioButton = this.getView()
          .getModel()
          .getProperty("/selectedRadioButton");

        const antragDatum = new Date();

        if (absenceTypeText === "Urlaub") {

          if (
            selectedRadioButton === "moreThanOneDay" &&
            Number(sDurationDays) > urlaubkontingent
          ) {
            MessageToast.show(
              `Ihr Urlaubskontingent reicht nicht aus. Verfügbare Tage: ${urlaubkontingent}`
            );
            return;
          }

          if (
            selectedRadioButton === "oneDayOrLess" &&
            (!oOneDayDate || !sStartTime || !sEndTime)
          ) {
            MessageToast.show("Bitte ein korrektes Datum und Zeiten eingeben.");
            return;
          }

          const antragTimestamp = firebase.Timestamp.fromDate(antragDatum);
          let docID = "";

          docID = "Urlaub_" + mitarbeiterId + "_" + Date.now();


          const requestDataUrlaub = {
            "Mitarbeiter-ID": mitarbeiterId,
            "Abwesenheit-ID": absenceTypeKey, 
            Antragsdatum: antragTimestamp,
            Status: "In Bearbeitung",
            Kommentare: sNote,
          };

          if (selectedRadioButton === "moreThanOneDay") {

            requestDataUrlaub.Startdatum =
              firebase.Timestamp.fromDate(oStartDate);
            requestDataUrlaub.Enddatum = firebase.Timestamp.fromDate(oEndDate);
            requestDataUrlaub.UrlaubKontingent = urlaubkontingent;
            requestDataUrlaub.geplanterUrlaubstage = Number(sDurationDays);
          } else {

            requestDataUrlaub.Datum = firebase.Timestamp.fromDate(oOneDayDate);
            requestDataUrlaub.Startzeit = sStartTime; 
            requestDataUrlaub.Endzeit = sEndTime;
            const neededDays = parseFloat(sHours) > 4 ? 1 : 0.5;
            requestDataUrlaub.geplanterUrlaubstage = neededDays;
            requestDataUrlaub.UrlaubKontingent = urlaubkontingent;
          }

          firebase.db
            .collection("Urlaubsplan")
            .doc(docID)
            .set(requestDataUrlaub)
            .then(() => {
              MessageToast.show("Urlaub erfolgreich beantragt.");
              this.clearInputFields([
                "datepicker",
                "beginnTimePicker",
                "endTimePicker",
                "durationInput",
                "Zeitraum",
                "durationTagInput",
                "noteTextArea",
              ]);
              sap.ui.core.UIComponent.getRouterFor(this).navTo(
                "absenceOverview"
              );
            })
            .catch((error) => {
              console.error("Fehler beim Speichern im Urlaubsplan:", error);
              MessageToast.show("Fehler beim Speichern des Urlaubs.");
            });
        } else {

          if (!oOneDayDate || !sStartTime || !sEndTime) {
            MessageToast.show(
              "Bitte Datum und Uhrzeiten für Teleworking eingeben."
            );
            return;
          }

          const antragTimestamp = firebase.Timestamp.fromDate(antragDatum);
          const oneDayTimestamp = firebase.Timestamp.fromDate(oOneDayDate);

          const sArbeitstunden = sHours ? sHours.toString() : "0";

          const docID = "Tele_" + mitarbeiterId + "_" + Date.now();

          const requestDataTele = {
            "Abwesenheit-ID": absenceTypeKey, 
            Antragsdatum: antragTimestamp, 
            Arbeitstunden: sArbeitstunden,
            Datum: oneDayTimestamp,
            Endzeit: sEndTime, 
            Kommentare: sNote, 
            "Mitarbeiter-ID": mitarbeiterId, 
            Startzeit: sStartTime, 
            Status: "In Bearbeitung", 
          };

          firebase.db
            .collection("Abwesenheiten")
            .doc(docID)
            .set(requestDataTele)
            .then(() => {
              MessageToast.show(absenceTypeText + " erfolgreich beantragt.");
              this.clearInputFields([
                "datepicker",
                "beginnTimePicker",
                "endTimePicker",
                "durationInput",
                "Zeitraum",
                "durationTagInput",
                "noteTextArea",
              ]);
              sap.ui.core.UIComponent.getRouterFor(this).navTo(
                "absenceOverview"
              );
            })
            .catch((error) => {
              console.error(
                "Fehler beim Speichern des Abwesenheiten-Dokuments:",
                error
              );
              MessageToast.show("Fehler beim Speichern der Abwesenheit.");
            });
        }
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
