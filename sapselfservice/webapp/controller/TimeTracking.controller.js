sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.TimeTracking", {
      onInit: function () {
        // Check if userModel
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
        var oModel = new JSONModel({
          entries: [],
        });
        this.getView().setModel(oModel, "timeTracking");
      },

      onAnzeigenPress: function () {
        var oDatePicker = this.byId("monthyearPicker");
        var selectedValue = oDatePicker.getValue();
    
        if (!selectedValue) {
            sap.m.MessageToast.show("Bitte wählen Sie Monat und Jahr aus.");
            return;
        }
    
        var parts = selectedValue.split(".");
        if (parts.length !== 2) {
            sap.m.MessageToast.show(
                "Ungültiges Datum. Bitte wählen Sie ein gültiges Datum."
            );
            return;
        }
    
        var month = parseInt(parts[0], 10); 
        var year = parseInt(parts[1], 10);
    
        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
            sap.m.MessageToast.show(
                "Ungültiges Datum. Bitte wählen Sie ein gültiges Datum."
            );
            return;
        }
    
        var startDate = new Date(year, month - 1, 1); // First day of the month
        var endDate = new Date(year, month, 0); // Last day of the month
    
        var startTimestamp = firebase.Timestamp.fromDate(startDate);
        var endTimestamp = firebase.Timestamp.fromDate(endDate);
    
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
            sap.m.MessageToast.show("User model is not set!");
            this.getOwnerComponent().getRouter().navTo("login");
            return;
        }
        var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
    
        // Query Firebase for data
        var query = firebase.db
            .collection("Zeiterfassung")
            .where("Datum", ">=", startTimestamp)
            .where("Datum", "<=", endTimestamp)
            .where("Mitarbeiter-ID", "==", mitarbeiterId);
    
        query
            .get()
            .then((snapshot) => {
                if (snapshot.empty) {
                    sap.m.MessageToast.show(
                        "Keine Einträge für den ausgewählten Monat und das Jahr gefunden."
                    );
                    return;
                }
    
                var data = [];
                snapshot.forEach((doc) => {
                    var entry = doc.data();
                    data.push({
                        Datum: entry.Datum.toDate().toLocaleDateString("de-DE"),
                        Arbeitsbeginn: entry.Arbeitsbeginn
                            ? entry.Arbeitsbeginn.toDate().toLocaleTimeString("de-DE")
                            : "",
                        Arbeitsend: entry.Arbeitsend
                            ? entry.Arbeitsend.toDate().toLocaleTimeString("de-DE")
                            : "",
                        Pausendauer: entry.Pausendauer
                            ? entry.Pausendauer.toString().substring(0, 10)
                            : "0",
                        Stundengesamt: entry.Stundengesamt.toFixed(1),
                    });
                });
    
                // Bind data to the table
                var oZeiterfassungModel = this.getView().getModel("ZeiterfassungModel");
                if (!oZeiterfassungModel) {
                    oZeiterfassungModel = new sap.ui.model.json.JSONModel();
                    this.getView().setModel(oZeiterfassungModel, "ZeiterfassungModel");
                }
                oZeiterfassungModel.setProperty("/entries", data);
    
                sap.m.MessageToast.show("Einträge erfolgreich geladen.");
            })
            .catch((error) => {
                console.error("Fehler beim Abrufen der Einträge:", error);
                sap.m.MessageToast.show(
                    "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
                );
            });
    }
    ,

      onAddRow: function () {
        var oModel = this.getView().getModel("timeTracking");
        var row = oModel.getProperty("/entries");

        row.push({
          selected: false,
          date: new Date().toISOString().split("T")[0],
          session1Start: null,
          session1End: null,
          session2Start: null,
          session2End: null,
          stunden: "",
          pause: "",
        });

        oModel.setProperty("/entries", row);
      },

      onDeleteRow: function () {
        var oModel = this.getView().getModel("timeTracking");
        var row = oModel.getProperty("/entries");
        var aFilteredEntries = row.filter(function (entry) {
          return !entry.selected;
        });
        oModel.setProperty("/entries", aFilteredEntries);
      },

      onSaveTimeTracking: function () {
        var oModel = this.getView().getModel("timeTracking");
        var entries = oModel.getProperty("/entries");

        if (!entries || entries.length === 0) {
          MessageToast.show("Keine Daten zum Speichern!");
          return;
        }

        entries.forEach((entry) => {
          if (!entry.date || !entry.session1Start || !entry.session1End) {
            MessageToast.show("Unvollständige Einträge übersprungen.");
            console.warn("Skipping incomplete entry:", entry);
            return;
          }
          var oUserModel = sap.ui.getCore().getModel("userModel");
          if (!oUserModel) {
            sap.m.MessageToast.show("User model is not set!");
            this.getOwnerComponent().getRouter().navTo("login");
            return;
          }
          var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");

          var parts = entry.date.split("/");
          var entryDate = new Date(parts[2], parts[1] - 1, parts[0]); // YYYY-MM-DD in local time
          if (isNaN(entryDate)) {
            MessageToast.show("Ungültiges Datum im Eintrag.");
            console.warn("Invalid date in entry:", entry);
            return;
          }

          var docID = `${entryDate.getFullYear()}-${String(
            entryDate.getMonth() + 1
          ).padStart(2, "0")}-${String(entryDate.getDate()).padStart(
            2,
            "0"
          )}_${mitarbeiterId}`;
          var zeiterfassungTable = firebase.db
            .collection("Zeiterfassung")
            .doc(docID);

          function _convertTimetoFirestoreTimestamp(date, timeString) {
            if (!timeString) return null;
            var dateTime = new Date(date.getTime());
            var [hours, minutes] = timeString.split(":");
            dateTime.setHours(hours, minutes, 0, 0);
            return firebase.Timestamp.fromDate(dateTime);
          }

          var pause = 0;
          var session1StartTime = _convertTimetoFirestoreTimestamp(
            entryDate,
            entry.session1Start
          );
          var session1EndTime = _convertTimetoFirestoreTimestamp(
            entryDate,
            entry.session1End
          );
          var session2StartTime = _convertTimetoFirestoreTimestamp(
            entryDate,
            entry.session2Start
          );
          var session2EndTime = _convertTimetoFirestoreTimestamp(
            entryDate,
            entry.session2End
          );

          if (session1EndTime && session2StartTime) {
            pause =
              (session2StartTime.toDate() - session1EndTime.toDate()) /
              (1000 * 60 * 60); // Convert to hours
          }

          var totalHours = 0;
          if (session1StartTime && session1EndTime) {
            totalHours +=
              (session1EndTime.toDate() - session1StartTime.toDate()) /
              (1000 * 60 * 60); // Convert to hours
          }
          if (session2StartTime && session2EndTime) {
            totalHours +=
              (session2EndTime.toDate() - session2StartTime.toDate()) /
              (1000 * 60 * 60); // Convert to hours
          }

          zeiterfassungTable
            .set({
              Datum: firebase.Timestamp.fromDate(entryDate),
              Arbeitsbeginn: session1StartTime,
              Arbeitsend: session2EndTime || session1EndTime,
              Pausendauer: pause || 0,
              Stundengesamt: totalHours || 0,
              "Mitarbeiter-ID": mitarbeiterId,
            })
            .then(() => {
              // Use local date format for consistent logging
              var formattedDate = entryDate.toLocaleDateString("de-DE", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              });
              console.log(`Eintrag für ${formattedDate} gespeichert.`);
            })
            .catch((error) => {
              console.error(`Fehler beim Speichern für ${entry.date}:`, error);
              MessageToast.show(`Fehler beim Speichern für ${entry.date}.`);
            });
        });
        MessageToast.show(
          `Erfolgreich beim Speichern ${entries.length} Einträge`
        );
        oModel.setProperty("/entries", []);
      },

      onCancelTimeTracking: function () {
        try {
          var oModel = this.getView().getModel("timeTracking");
          oModel.setProperty("/entries", []);
          var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("Main");
        } catch (e) {
          console.error("Fehler bei der Navigation zurück:", e);
        }
      },

      onValidateTime: function (oEvent) {
        var oSource = oEvent.getSource();
        var oBindingContext = oSource.getBindingContext("timeTracking");
        var oEntry = oBindingContext.getObject();

        var session1Start = oEntry.session1Start
          ? _convertTimeToDate(oEntry.session1Start)
          : null;
        var session1End = oEntry.session1End
          ? _convertTimeToDate(oEntry.session1End)
          : null;
        var session2Start = oEntry.session2Start
          ? _convertTimeToDate(oEntry.session2Start)
          : null;
        var session2End = oEntry.session2End
          ? _convertTimeToDate(oEntry.session2End)
          : null;

        var isValid = true;
        if (
          (session1Start && session1End && session1Start > session1End) ||
          (session1End && session2Start && session1End > session2Start) ||
          (session2Start && session2End && session2Start > session2End) ||
          (session1Start && session2End && session1Start > session2End)
        ) {
          oSource.setValueState("Error");
          oSource.setValueStateText("Ungültige Zeitangabe.");
          isValid = false;
        } else {
          oSource.setValueState("None");
        }
        this._setSaveButtonState(isValid);
        function _convertTimeToDate(timeString) {
          if (!timeString) return null;
          var parts = timeString.split(":");
          return new Date(2024, 365, 12, parts[0], parts[1], parts[2] || 0);
        }
      },

      _setSaveButtonState: function (isValid) {
        var oSaveButton = this.byId("saveButton");
        if (oSaveButton) {
          oSaveButton.setEnabled(isValid);
        }
      },
      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
  }
);
