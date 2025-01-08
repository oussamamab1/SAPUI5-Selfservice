sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, UIComponent, firebase) {
    "use strict";

    return Controller.extend(
      "sapselfservice.controller.AbsenceOverviewManager",
      {
        onInit: function () {
          // userModel direkt vom Core holen:
          var oModel = sap.ui.getCore().getModel("userModel");
          if (!oModel) {
            console.error("userModel not found in AbsenceOverviewManager!");
            return;
          }

          var sMitarbeiterID = oModel.getProperty("/Mitarbeiter-ID");
          if (!sMitarbeiterID) {
            console.error("No Mitarbeiter-ID in userModel!");
            return;
          }

          // Überprüfen, ob der Benutzer ein Abteilungsleiter ist
          firebase.db
            .collection("Abteilung")
            .where("Abteilungsleiter-ID", "==", sMitarbeiterID)
            .get()
            .then((querySnapshot) => {
              if (!querySnapshot.empty) {
                // wenn der Benutzer ein Abteilungsleiter ist, dann die Abteilungs-ID abrufen
                querySnapshot.forEach((doc) => {
                  var sAbteilungsID = doc.data()["Abteilungs-ID"];

                  // Mitarbeiter-IDs aus der Tabelle OrganisatorischeZuordnung abrufen
                  firebase.db
                    .collection("OrganisatorischeZuordnung")
                    .where("Abteilung-ID", "==", sAbteilungsID)
                    .get()
                    .then((employeeSnapshot) => {
                      var aMitarbeiterIDs = [];

                      employeeSnapshot.forEach((employeeDoc) => {
                        // alle Mitarbeiter außer dem Abteilungsleiter hinzufügen
                        if (
                          employeeDoc.data()["Mitarbeiter-ID"] !==
                          sMitarbeiterID
                        ) {
                          aMitarbeiterIDs.push(
                            employeeDoc.data()["Mitarbeiter-ID"]
                          );
                        }
                      });

                      // Abwesenheitsdaten für die Mitarbeiter abrufen
                      this._loadAbsenceData(aMitarbeiterIDs);
                    })
                    .catch((error) => {
                      console.error(
                        "Fehler beim Abrufen der Mitarbeiter aus OrganisatorischeZuordnung:",
                        error
                      );
                    });
                });
              } else {
                console.log("Benutzer ist kein Abteilungsleiter.");
              }
            })
            .catch((error) => {
              console.error(
                "Fehler beim Überprüfen der Abteilungsleiter-ID:",
                error
              );
            });
        },

        _loadAbsenceData: function (aMitarbeiterIDs) {
          var aAbsences = [];
          // Wieder: userModel vom Core holen (optional)
          var oModel = sap.ui.getCore().getModel("userModel");

          firebase.db
            .collection("Abwesenheiten")
            .where("Mitarbeiter-ID", "in", aMitarbeiterIDs)
            .get()
            .then((absenceSnapshot) => {
              var aPromises = [];

              absenceSnapshot.forEach((absenceDoc) => {
                var oAbsence = absenceDoc.data();
                var sMitarbeiterID = oAbsence["Mitarbeiter-ID"];

                // Abwesenheitsart-Beschreibung holen
                var pAbsenceType = firebase.db
                  .collection("Abwesenheitsart")
                  .doc(oAbsence["Abwesenheit-ID"])
                  .get()
                  .then((absenceTypeDoc) => {
                    oAbsence["Abwesenheitsart"] =
                      absenceTypeDoc.data()["Beschreibung"];
                  });

                // Mitarbeiterdaten holen (Vorname, Nachname)
                var pEmployeeData = firebase.db
                  .collection("DatenZurPerson")
                  .doc(sMitarbeiterID)
                  .get()
                  .then((employeeDoc) => {
                    var oEmployee = employeeDoc.data();
                    oAbsence["Name"] =
                      oEmployee["Vorname"] + " " + oEmployee["Nachname"];
                  });

                aPromises.push(
                  Promise.all([pAbsenceType, pEmployeeData]).then(() => {
                    aAbsences.push(oAbsence);
                  })
                );
              });

              Promise.all(aPromises).then(() => {
                // Ergebnis im Model speichern
                // Hier könnten wir z.B. /absences im userModel oder eigenem ViewModel ablegen
                oModel.setProperty("/absences", aAbsences);
              });
            })
            .catch((error) => {
              console.error("Fehler beim Abrufen der Abwesenheiten:", error);
            });
        },

        onDetailsPress: function (oEvent) {
          const oContext = oEvent.getSource().getBindingContext();
          const oRouter = UIComponent.getRouterFor(this);
          oRouter.navTo("AbsenceDetailsManager", {
            MitarbeiterID: oContext.getProperty("MitarbeiterID"),
          });
        },
        onNavBack: function () {
          sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
        },
      }
    );
  }
);
