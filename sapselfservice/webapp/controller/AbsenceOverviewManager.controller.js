sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat", 
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, DateFormat, firebase) {
    "use strict";

    return Controller.extend(
      "sapselfservice.controller.AbsenceOverviewManager",
      {
        onInit: function () {
          // 1) userModel holen
          var oUserModel = sap.ui.getCore().getModel("userModel");
          if (!oUserModel) {
            // => Session check
            this._restoreSessionOrGoLogin();
          } else {
            // userModel ist da => regulär fortfahren
            this._continueInit();
          }
        },

        /**
         * Versucht, eine bestehende Session aus sessionStorage herzustellen.
         * Falls vorhanden => userModel neu setzen, sonst => login.
         */
        _restoreSessionOrGoLogin: function () {
          var sessionId = sessionStorage.getItem("currentSessionId");
          if (sessionId) {
            var userDataString = sessionStorage.getItem(sessionId);
            if (userDataString) {
              try {
                var userData = JSON.parse(userDataString);
                var oNewUserModel = new JSONModel(userData);
                sap.ui.getCore().setModel(oNewUserModel, "userModel");
                // Weiter
                this._continueInit();
                return;
              } catch (err) {
                console.error("Fehler beim Parsen der Session-Daten:", err);
              }
            }
          }
          // Keine Session => login
          MessageToast.show("Bitte erst einloggen.");
          this.getOwnerComponent().getRouter().navTo("login");
        },

        
        _continueInit: function () {
          // 1) Eingeloggter Benutzer (Mitarbeiter-ID)
          var oUserModel = sap.ui.getCore().getModel("userModel");
          if (!oUserModel) {
            MessageToast.show("User model ist nicht gesetzt!");
            this.getOwnerComponent().getRouter().navTo("login");
            return;
          }
          this.getView().setModel(oUserModel, "userModel");

          // 2) JSONModel für Abwesenheiten
          var oAbsencesModel = new JSONModel({
            Absences: [],
            noDataMessage: "Daten werden geladen",
          });
          this.getView().setModel(oAbsencesModel, "absencesModel");

          // 3) Daten laden
          this._loadAbsences();
        },

        /**
         * 1) Hole CEO-Stellen-ID (Stelle => "Chief Executiv Officer")
         * 2) Hole Liste aller Mitarbeiter-IDs, die CEO sind
         * 3) Prüfe, ob aktueller Nutzer => CEO
         * 4) Hole relevante Mitarbeiter (je nachdem, ob CEO oder normaler Abteilungsleiter)
         * 5) Hole Personendaten (Vorname, Nachname) für alle relevanten MA
         * 6) Lade die Abwesenheiten (Status="In Bearbeitung") dieser MA
         * 7) Füge Name zusammen und setze ggf. Startdatum=Enddatum=Datum
         *    => Erzeuge zusätzlich FormattedStart / FormattedEnd
         */
        _loadAbsences: function () {
          var oView = this.getView();
          var oAbsencesModel = oView.getModel("absencesModel");
          oAbsencesModel.setProperty("/noDataMessage", "Daten werden geladen");
          oAbsencesModel.setProperty("/Absences", []);

          // Eingeloggter User
          var sCurrentUser = oView
            .getModel("userModel")
            .getProperty("/Mitarbeiter-ID");
          let aRelevantEmpIDs = [];

          // 1) CEO-Stelle
          this._getCeoStellenID()
            .then((sCeoStelleID) => {
              // 2) alle CEO-Mitarbeiter-IDs in unserem Fall nur die eine, aber wir wollten unsere Webanwendung dynamisch halten
              return this._getAllCEOs(sCeoStelleID);
            })
            .then((aCEOMitarbeiterIDs) => {
              // 3) Check: Ist sCurrentUser " aktueller User" in aCEOMitarbeiterIDs? 
              var bIsCEO = aCEOMitarbeiterIDs.includes(sCurrentUser);

              if (bIsCEO) {
                // CEO => alle MA (außer er selbst)
                return this._getAllEmployeesButMe(sCurrentUser);
              } else {
                // Abteilungsleiter => nur MA aus seinen Abteilungen (außer er selbst)
                return this._getManagedEmployeesButMe(sCurrentUser);
              }
            })
            .then((aEmpIDs) => {
              aRelevantEmpIDs = aEmpIDs;
              // 4) Personendaten (Vorname, Nachname) für alle relevanten MA
              return this._getPersonenMap(aEmpIDs);
            })
            .then((oPersonMap) => {
              // 5) Abwesenheiten für aRelevantEmpIDs laden (Status="In Bearbeitung")
              return this._loadAbsencesByEmployees(aRelevantEmpIDs, oPersonMap);
            })
            .then((aAbsences) => {
              // Ergebnis im Model ablegen
              if (aAbsences.length === 0) {
                oAbsencesModel.setProperty(
                  "/noDataMessage",
                  "Keine vorhandenen Daten"
                );
              } else {
                oAbsencesModel.setProperty("/noDataMessage", "");
              }
              oAbsencesModel.setProperty("/Absences", aAbsences);
            })
            .catch((error) => {
              console.error("Fehler:", error);
              oAbsencesModel.setProperty(
                "/noDataMessage",
                "Keine vorhandenen Daten"
              );
            });
        },

        /**
         *  Lädt aus "Stelle" den Eintrag, dessen "Stellenbezeichnung" = "Chief Executiv Officer"
         *  => gibt dessen "Stellen-ID" zurück (z. B. "S001").
         */
        _getCeoStellenID: function () {
          return new Promise((resolve, reject) => {
            firebase.db
              .collection("Stelle")
              .where("Stellenbezeichnung", "==", "Chief Executiv Officer")
              .get()
              .then((snapshot) => {
                if (snapshot.empty) {
                  return reject("Keine CEO-Stelle gefunden.");
                }
                let sCeoID = null;
                snapshot.forEach((doc) => {
                  sCeoID = doc.data()["Stellen-ID"];
                });
                if (!sCeoID) {
                  return reject("Keine Stellen-ID für CEO gefunden.");
                }
                resolve(sCeoID);
              })
              .catch(reject);
          });
        },

        /**
         * Gibt ein Array aller MA-IDs zurück, die die CEO-Stelle (sCeoStelleID) haben.
         * => Aus "StelleRolle" (wo "Stellen-ID" == sCeoStelleID)
         */
        _getAllCEOs: function (sCeoStelleID) {
          return new Promise((resolve, reject) => {
            firebase.db
              .collection("StelleRolle")
              .where("Stellen-ID", "==", sCeoStelleID)
              .get()
              .then((snapshot) => {
                const aCEOs = [];
                snapshot.forEach((doc) => {
                  aCEOs.push(doc.data()["Mitarbeiter-ID"]);
                });
                resolve(aCEOs);
              })
              .catch(reject);
          });
        },

        /**
         * Gibt ein Array ALLER Mitarbeiter-IDs zurück (aus "DatenZurPerson"),
         * exkl. sCurrentUser.
         */
        _getAllEmployeesButMe: function (sCurrentUser) {
          return new Promise((resolve, reject) => {
            firebase.db
              .collection("DatenZurPerson")
              .get()
              .then((snapshot) => {
                const aAll = [];
                snapshot.forEach((doc) => {
                  aAll.push(doc.data()["Mitarbeiter-ID"]);
                });
                // exkludiere den Nutzer selbst
                const aFiltered = aAll.filter((id) => id !== sCurrentUser);
                resolve(aFiltered);
              })
              .catch(reject);
          });
        },

        /**
         * Abteilungsleiter-Logik:
         * - Abteilungen -> "Abteilungsleiter-ID" == sCurrentUser
         * - OrganisatorischeZuordnung -> MA-IDs
         * - exkl. sCurrentUser
         */
        _getManagedEmployeesButMe: function (sCurrentUser) {
          return new Promise((resolve, reject) => {
            let aDeptIDs = [];
            let aEmpIDs = [];

            firebase.db
              .collection("Abteilung")
              .where("Abteilungsleiter-ID", "==", sCurrentUser)
              .get()
              .then((snapshotDept) => {
                if (snapshotDept.empty) {
                  // Hat keine Abteilung => keine MA
                  return resolve([]);
                }
                snapshotDept.forEach((doc) => {
                  aDeptIDs.push(doc.data()["Abteilung-ID"]);
                });

                return firebase.db
                  .collection("OrganisatorischeZuordnung")
                  .where("Abteilung-ID", "in", aDeptIDs)
                  .get();
              })
              .then((snapshotOrg) => {
                if (!snapshotOrg) {
                  return; 
                }
                snapshotOrg.forEach((doc) => {
                  aEmpIDs.push(doc.data()["Mitarbeiter-ID"]);
                });
                const aFiltered = aEmpIDs.filter((id) => id !== sCurrentUser);
                resolve(aFiltered);
              })
              .catch(reject);
          });
        },

        /**
         * Lädt eine Map (Mitarbeiter-ID -> {Vorname, Nachname})
         * aus "DatenZurPerson" für das Array aEmpIDs.
         */
        _getPersonenMap: function (aEmpIDs) {
          return new Promise((resolve, reject) => {
            if (!aEmpIDs || aEmpIDs.length === 0) {
              return resolve({});
            }
            firebase.db
              .collection("DatenZurPerson")
              .where("Mitarbeiter-ID", "in", aEmpIDs)
              .get()
              .then((snapshot) => {
                let oMap = {};
                snapshot.forEach((doc) => {
                  const d = doc.data();
                  const sMID = d["Mitarbeiter-ID"];
                  oMap[sMID] = {
                    Vorname: d["Vorname"] || "",
                    Nachname: d["Nachname"] || "",
                  };
                });
                resolve(oMap);
              })
              .catch(reject);
          });
        },

        /**
         * Lädt Abwesenheiten (Status="In Bearbeitung") für die Mitarbeiter-IDs in aEmpIDs
         * und baut den vollständigen Datensatz inkl. Name (Vorname+Nachname) auf.
         * Falls nur "Datum" vorhanden, setzen wir Start=End=Datum.
         * Danach konvertieren wir Start/End in JS-Date, formatieren und schreiben
         * FormattedStart / FormattedEnd.
         */
        _loadAbsencesByEmployees: function (aEmpIDs, oPersonMap) {
          return new Promise((resolve, reject) => {
            if (!aEmpIDs || aEmpIDs.length === 0) {
              return resolve([]);
            }
            firebase.db
              .collection("Abwesenheiten")
              .where("Mitarbeiter-ID", "in", aEmpIDs)
              .where("Status", "==", "In Bearbeitung")
              .get()
              .then((snapshotAbs) => {
                if (snapshotAbs.empty) {
                  return resolve([]);
                }

                let aResult = [];
                snapshotAbs.forEach((doc) => {
                  let oData = doc.data();
                  // doc.id => eindeutig für Update
                  oData.docId = doc.id;

                  // Falls "Datum" existiert, aber kein Start-/Enddatum,
                  // setzen wir Start=End=Datum
                  if (
                    !oData["Startdatum"] &&
                    !oData["Enddatum"] &&
                    oData["Datum"]
                  ) {
                    oData["Startdatum"] = oData["Datum"];
                    oData["Enddatum"] = oData["Datum"];
                  }

                  // Name zusammensetzen
                  const sMID = oData["Mitarbeiter-ID"];
                  const sVorname = oPersonMap[sMID]?.Vorname || "";
                  const sNachname = oPersonMap[sMID]?.Nachname || "";
                  oData["DisplayName"] = (sVorname + " " + sNachname).trim();

                  // Jetzt Startdatum/Enddatum formatieren => FormattedStart / FormattedEnd
                  if (oData["Startdatum"]) {
                    let oJsDate = this._convertToDate(oData["Startdatum"]);
                    oData["FormattedStart"] = oJsDate
                      ? this._formatDate(oJsDate)
                      : "";
                  } else {
                    oData["FormattedStart"] = "";
                  }

                  if (oData["Enddatum"]) {
                    let oJsDateEnd = this._convertToDate(oData["Enddatum"]);
                    oData["FormattedEnd"] = oJsDateEnd
                      ? this._formatDate(oJsDateEnd)
                      : "";
                  } else {
                    oData["FormattedEnd"] = "";
                  }

                  aResult.push(oData);
                });
                resolve(aResult);
              })
              .catch(reject);
          });
        },

        /**
         * Versucht einen Firestore Timestamp oder ein Date-String in ein JS-Date zu wandeln.
         */
        _convertToDate: function (vDate) {
          if (!vDate) {
            return null;
          }
          // Firestore Timestamp => .toDate()
          if (vDate.toDate) {
            return vDate.toDate();
          }
          // Wenn es ein JS Date oder ein String ist:
          return new Date(vDate);
        },

        /**
         * Formatiert ein JS-Date in dd.MM.yyyy .
         */
        _formatDate: function (oDate) {
          var oFormatter = DateFormat.getDateInstance({
            pattern: "dd.MM.yyyy",
          });
          return oFormatter.format(oDate);
        },

        /**
         * Genehmigen
         */
        onApproveAbsence: function (oEvent) {
          var oItemCtx = oEvent.getSource().getBindingContext("absencesModel");
          var oAbsenceData = oItemCtx.getObject();
          var sDocId = oAbsenceData.docId;

          if (!sDocId) {
            MessageToast.show("Fehler: Keine Dokumenten-ID gefunden.");
            return;
          }

          firebase.db
            .collection("Abwesenheiten")
            .doc(sDocId)
            .update({ Status: "Genehmigt" })
            .then(
              function () {
                MessageToast.show("Antrag wurde genehmigt.");
                this._loadAbsences(); 
              }.bind(this)
            )
            .catch(function (error) {
              console.error("Fehler beim Genehmigen:", error);
              MessageToast.show("Fehler beim Genehmigen.");
            });
        },

        /**
         * Ablehnen
         */
        onRejectAbsence: function (oEvent) {
          var oItemCtx = oEvent.getSource().getBindingContext("absencesModel");
          var oAbsenceData = oItemCtx.getObject();
          var sDocId = oAbsenceData.docId;

          if (!sDocId) {
            MessageToast.show("Fehler: Keine Dokumenten-ID gefunden.");
            return;
          }

          firebase.db
            .collection("Abwesenheiten")
            .doc(sDocId)
            .update({ Status: "Abgelehnt" })
            .then(
              function () {
                MessageToast.show("Antrag wurde abgelehnt.");
                this._loadAbsences();
              }.bind(this)
            )
            .catch(function (error) {
              console.error("Fehler beim Ablehnen:", error);
              MessageToast.show("Fehler beim Ablehnen.");
            });
        },

        onNavBack: function () {
          sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
        },
      }
    );
  }
);
