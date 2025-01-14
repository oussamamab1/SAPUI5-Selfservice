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
                var oNewUserModel = new JSONModel(userData);
                sap.ui.getCore().setModel(oNewUserModel, "userModel");
                this._continueInit();
                return;
              } catch (err) {
                console.error("Fehler beim Parsen der Session-Daten:", err);
              }
            }
          }
          MessageToast.show("Bitte erst einloggen.");
          this.getOwnerComponent().getRouter().navTo("login");
        },

        _continueInit: function () {
          var oUserModel = sap.ui.getCore().getModel("userModel");
          if (!oUserModel) {
            MessageToast.show("User model ist nicht gesetzt!");
            this.getOwnerComponent().getRouter().navTo("login");
            return;
          }
          this.getView().setModel(oUserModel, "userModel");

          var oAbsencesModel = new JSONModel({
            Absences: [],
            noDataMessage: "Daten werden geladen",
          });
          this.getView().setModel(oAbsencesModel, "absencesModel");

          // Haupt-Ladefunktion
          this._loadAbsences();
        },

        /**
         * Hauptlogik für "Wer sieht was?":
         *  - Hole Stellen-ID vom CEO und daraus alle CEO-Mitarbeiter-IDs
         *  - Prüfe, ob currentUser in den CEO-IDs enthalten ist (bIsCEO)
         *  - Falls bIsCEO:
         *     -> Lade alle Abteilungsleiter-IDs (ohne mich selbst)
         *     -> Prüfe, welche dieser AL "abwesend" sind (hier: Status "In Bearbeitung" oder "Genehmigt")
         *     -> Für abwesende AL zusätzlich deren Teams laden
         *  - Falls KEIN CEO:
         *     -> Lade nur eigene Mitarbeiter (wie bisher)
         *  - Lade anschließend Abwesenheiten / Urlaubsplan
         *  - Zusammenführen & in Model packen
         */
        _loadAbsences: function () {
          var oView = this.getView();
          var oAbsencesModel = oView.getModel("absencesModel");
          oAbsencesModel.setProperty("/noDataMessage", "Daten werden geladen");
          oAbsencesModel.setProperty("/Absences", []);

          var sCurrentUser = oView
            .getModel("userModel")
            .getProperty("/Mitarbeiter-ID");
          let aRelevantEmpIDs = [];

          // 1) CEO-Stellen-ID laden
          this._getCeoStellenID()
            .then((sCeoStelleID) => {
              // 2) alle Mitarbeiter-IDs, die auf CEO-Stelle gemappt sind
              return this._getAllCEOs(sCeoStelleID);
            })
            .then((aCEOMitarbeiterIDs) => {
              // Check, ob aktueller User CEO ist
              var bIsCEO = aCEOMitarbeiterIDs.includes(sCurrentUser);

              if (bIsCEO) {
                // CEO => hole alle Abteilungsleiter (ohne mich selbst)
                return this._getAllDepartmentLeadersButMe(sCurrentUser).then(
                  (aLeaderIDs) => {
                    // Nun checken, welche AL "abwesend" sind
                    return this._whoIsAbsent(aLeaderIDs).then(
                      (aAbsentLeaders) => {
                        if (aAbsentLeaders.length === 0) {
                          // Falls keiner abwesend => CEO sieht nur die Abteilungsleiter
                          return aLeaderIDs;
                        }
                        // Für abwesende AL => deren Mitarbeiter laden
                        return this._getEmployeesOfLeaders(aAbsentLeaders).then(
                          (aEmployeesOfAllAbsentLeaders) => {
                            // Kombiniere AL + deren Mitarbeiter
                            let combined = [
                              ...aLeaderIDs,
                              ...aEmployeesOfAllAbsentLeaders,
                            ];
                            // Duplikate entfernen
                            let unique = [...new Set(combined)];
                            return unique;
                          }
                        );
                      }
                    );
                  }
                );
              } else {
                // "Normaler" Abteilungsleiter => lade nur eigene Mitarbeiter
                return this._getManagedEmployeesButMe(sCurrentUser);
              }
            })
            .then((aEmpIDs) => {
              aRelevantEmpIDs = aEmpIDs;
              // Personendaten für alle relevanten IDs laden
              return this._getPersonenMap(aRelevantEmpIDs);
            })
            .then((oPersonMap) => {
              // Parallel: Abwesenheiten (Collection "Abwesenheiten") + Urlaubsplan laden
              return Promise.all([
                this._loadAbwesenheiten(aRelevantEmpIDs),
                this._loadUrlaubsplan(aRelevantEmpIDs),
              ]).then(([aAbsences, aUrlaub]) => {
                let aAll = aAbsences.concat(aUrlaub);
                return this._augmentAbsences(aAll, oPersonMap);
              });
            })
            .then((aAllAbsences) => {
              if (aAllAbsences.length === 0) {
                oAbsencesModel.setProperty(
                  "/noDataMessage",
                  "Keine vorhandenen Daten"
                );
              } else {
                oAbsencesModel.setProperty("/noDataMessage", "");
              }
              oAbsencesModel.setProperty("/Absences", aAllAbsences);
            })
            .catch((err) => {
              console.error("Fehler:", err);
              oAbsencesModel.setProperty(
                "/noDataMessage",
                "Keine vorhandenen Daten"
              );
            });
        },

        /**
         * Helfer-Funktion: Gibt die CEO-Stellen-ID zurück
         */
        _getCeoStellenID: function () {
          return new Promise((resolve, reject) => {
            firebase.db
              .collection("Stelle")
              .where("Stellenbezeichnung", "==", "Chief Executiv Officer")
              .get()
              .then((snap) => {
                if (snap.empty) {
                  return reject("Keine CEO-Stelle gefunden.");
                }
                let sCeoID = null;
                snap.forEach((doc) => {
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
         * Alle Mitarbeiter-IDs, die als Rolle/Zuordnung auf der CEO-Stelle liegen
         */
        _getAllCEOs: function (sCeoStelleID) {
          return new Promise((resolve, reject) => {
            firebase.db
              .collection("StelleRolle")
              .where("Stellen-ID", "==", sCeoStelleID)
              .get()
              .then((snap) => {
                let aRes = [];
                snap.forEach((doc) => {
                  aRes.push(doc.data()["Mitarbeiter-ID"]);
                });
                resolve(aRes);
              })
              .catch(reject);
          });
        },

        /**
         * Liest aus "Abteilung" alle Abteilungsleiter-IDs und entfernt den aktuellen User (CEO)
         */
        _getAllDepartmentLeadersButMe: function (sCurrentUser) {
          return new Promise((resolve, reject) => {
            firebase.db
              .collection("Abteilung")
              .get()
              .then((snapshot) => {
                if (snapshot.empty) {
                  return resolve([]);
                }
                let aLeiterIDs = [];
                snapshot.forEach((doc) => {
                  let sLeiter = doc.data()["Abteilungsleiter-ID"];
                  if (sLeiter && !aLeiterIDs.includes(sLeiter)) {
                    aLeiterIDs.push(sLeiter);
                  }
                });
                // Mich selbst (CEO) entfernen
                let aFiltered = aLeiterIDs.filter((id) => id !== sCurrentUser);
                resolve(aFiltered);
              })
              .catch(reject);
          });
        },

        /**
         * Liest alle Mitarbeiter einer Abteilung, deren Abteilungsleiter == sCurrentUser ist
         * und entfernt den Leiter selbst aus der Liste
         */
        _getManagedEmployeesButMe: function (sCurrentUser) {
          return new Promise((resolve, reject) => {
            let aDeptIDs = [];
            let aEmpIDs = [];

            firebase.db
              .collection("Abteilung")
              .where("Abteilungsleiter-ID", "==", sCurrentUser)
              .get()
              .then((snapDept) => {
                if (snapDept.empty) {
                  return resolve([]);
                }
                snapDept.forEach((doc) => {
                  aDeptIDs.push(doc.data()["Abteilung-ID"]);
                });
                // OrganisatorischeZuordnung abfragen
                return firebase.db
                  .collection("OrganisatorischeZuordnung")
                  .where("Abteilung-ID", "in", aDeptIDs)
                  .get();
              })
              .then((snapOrg) => {
                if (!snapOrg) {
                  return;
                }
                snapOrg.forEach((doc) => {
                  aEmpIDs.push(doc.data()["Mitarbeiter-ID"]);
                });
                // Leiter selbst entfernen
                let aFiltered = aEmpIDs.filter((id) => id !== sCurrentUser);
                resolve(aFiltered);
              })
              .catch(reject);
          });
        },

        /**
         * Ermittelt anhand der an "aLeaderIDs" übergebenen Abteilungsleiter,
         * wer "abwesend" ist. Hier z. B. Status = "In Bearbeitung" oder "Genehmigt".
         */
        _whoIsAbsent: function (aLeaderIDs) {
          return new Promise((resolve, reject) => {
            if (!aLeaderIDs || aLeaderIDs.length === 0) {
              return resolve([]);
            }
            let aPromises = [];

            // Abwesenheiten
            let p1 = firebase.db
              .collection("Abwesenheiten")
              .where("Mitarbeiter-ID", "in", aLeaderIDs)
              .where("Status", "in", ["In Bearbeitung", "Genehmigt"])
              .get();

            // Urlaubsplan
            let p2 = firebase.db
              .collection("Urlaubsplan")
              .where("Mitarbeiter-ID", "in", aLeaderIDs)
              .where("Status", "in", ["In Bearbeitung", "Genehmigt"])
              .get();

            aPromises.push(p1, p2);

            Promise.all(aPromises)
              .then((results) => {
                let aAbsentLeaders = [];
                results.forEach((snap) => {
                  snap.forEach((doc) => {
                    const mid = doc.data()["Mitarbeiter-ID"];
                    if (!aAbsentLeaders.includes(mid)) {
                      aAbsentLeaders.push(mid);
                    }
                  });
                });
                resolve(aAbsentLeaders);
              })
              .catch(reject);
          });
        },

        /**
         * Findet alle Mitarbeiter in Abteilungen, deren "Abteilungsleiter-ID" in "aLeaderIDs" enthalten ist.
         */
        _getEmployeesOfLeaders: function (aLeaderIDs) {
          return new Promise((resolve, reject) => {
            // 1) Abteilungs-IDs aller relevanten Leiter holen
            firebase.db
              .collection("Abteilung")
              .where("Abteilungsleiter-ID", "in", aLeaderIDs)
              .get()
              .then((snapDept) => {
                if (snapDept.empty) {
                  return resolve([]);
                }
                let aDeptIDs = [];
                snapDept.forEach((doc) => {
                  aDeptIDs.push(doc.data()["Abteilung-ID"]);
                });
                // 2) Alle Mitarbeiter aus diesen Abteilungen
                return firebase.db
                  .collection("OrganisatorischeZuordnung")
                  .where("Abteilung-ID", "in", aDeptIDs)
                  .get();
              })
              .then((snapOrg) => {
                if (!snapOrg) return resolve([]);
                let aAllEmps = [];
                snapOrg.forEach((doc) => {
                  aAllEmps.push(doc.data()["Mitarbeiter-ID"]);
                });
                resolve(aAllEmps);
              })
              .catch(reject);
          });
        },

        /**
         * Lädt Personendaten und gibt ein Map zurück, z. B. { "M123": { Vorname: "Max", Nachname: "Mustermann" }, ... }
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
              .then((snap) => {
                let oMap = {};
                snap.forEach((doc) => {
                  let d = doc.data();
                  let mid = d["Mitarbeiter-ID"];
                  oMap[mid] = {
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
         * Lädt alle Einträge aus "Abwesenheiten" mit Status = "In Bearbeitung"
         */
        _loadAbwesenheiten: function (aEmpIDs) {
          return new Promise((resolve, reject) => {
            if (!aEmpIDs || aEmpIDs.length === 0) {
              return resolve([]);
            }
            firebase.db
              .collection("Abwesenheiten")
              .where("Mitarbeiter-ID", "in", aEmpIDs)
              .where("Status", "==", "In Bearbeitung")
              .get()
              .then((snapshot) => {
                let aRes = [];
                snapshot.forEach((doc) => {
                  let oData = doc.data();
                  oData._collection = "Abwesenheiten";
                  oData.docId = doc.id;
                  aRes.push(oData);
                });
                resolve(aRes);
              })
              .catch(reject);
          });
        },

        /**
         * Lädt alle Einträge aus "Urlaubsplan" mit Status = "In Bearbeitung"
         */
        _loadUrlaubsplan: function (aEmpIDs) {
          return new Promise((resolve, reject) => {
            if (!aEmpIDs || aEmpIDs.length === 0) {
              return resolve([]);
            }
            firebase.db
              .collection("Urlaubsplan")
              .where("Mitarbeiter-ID", "in", aEmpIDs)
              .where("Status", "==", "In Bearbeitung")
              .get()
              .then((snap) => {
                let aRes = [];
                snap.forEach((doc) => {
                  let oData = doc.data();
                  oData._collection = "Urlaubsplan";
                  oData.docId = doc.id;
                  aRes.push(oData);
                });
                resolve(aRes);
              })
              .catch(reject);
          });
        },

        /**
         * Führt die einzelnen Abwesenheiten mit Personen-Daten (Name, Datum-Format etc.) zusammen
         */
        _augmentAbsences: async function (aAllAbsences, oPersonMap) {
          let aResults = [];

          for (let oData of aAllAbsences) {
            // Start/End-Datum verarbeiten (falls nur "Datum" vorhanden)
            if (!oData["Startdatum"] && !oData["Enddatum"] && oData["Datum"]) {
              oData["Startdatum"] = oData["Datum"];
              oData["Enddatum"] = oData["Datum"];
            }

            // Personendaten
            let sMID = oData["Mitarbeiter-ID"];
            let sVorname = oPersonMap[sMID]?.Vorname || "";
            let sNachname = oPersonMap[sMID]?.Nachname || "";
            oData["DisplayName"] = (sVorname + " " + sNachname).trim();

            // Formatiertes Start/Enddatum
            if (oData["Startdatum"]) {
              let oStart = this._convertToDate(oData["Startdatum"]);
              oData["FormattedStart"] = oStart ? this._formatDate(oStart) : "";
            } else {
              oData["FormattedStart"] = "";
            }
            if (oData["Enddatum"]) {
              let oEnd = this._convertToDate(oData["Enddatum"]);
              oData["FormattedEnd"] = oEnd ? this._formatDate(oEnd) : "";
            } else {
              oData["FormattedEnd"] = "";
            }

            // Abwesenheitsart-Beschreibung
            if (oData["Abwesenheit-ID"]) {
              try {
                let sAbID = oData["Abwesenheit-ID"];
                let sBeschreibung = await this._fetchAbsenceTypeDescription(
                  sAbID
                );
                oData["AbwesenheitsartBeschreibung"] =
                  sBeschreibung || "Unbekannt";
              } catch (err) {
                console.error("Fehler beim Laden Abwesenheitsart:", err);
                oData["AbwesenheitsartBeschreibung"] = "Unbekannt";
              }
            } else {
              oData["AbwesenheitsartBeschreibung"] = "";
            }

            aResults.push(oData);
          }

          return aResults;
        },

        /**
         * Lädt aus "Abwesenheitsart" die Beschreibung, z. B. "Urlaub" etc.
         */
        _fetchAbsenceTypeDescription: function (sAbID) {
          return firebase.db
            .collection("Abwesenheitsart")
            .where("Abwesenheit-ID", "==", sAbID)
            .get()
            .then((snap) => {
              if (snap.empty) {
                return "Unbekannt";
              }
              let doc = snap.docs[0];
              return doc.data()["Beschreibung"] || "Unbekannt";
            })
            .catch(() => "Unbekannt");
        },

        _convertToDate: function (vDate) {
          if (!vDate) return null;
          if (vDate.toDate) {
            return vDate.toDate();
          }
          return new Date(vDate);
        },

        _formatDate: function (oDate) {
          var oFormatter = DateFormat.getDateInstance({
            pattern: "dd.MM.yyyy",
          });
          return oFormatter.format(oDate);
        },

        onApproveAbsence: function (oEvent) {
          var oItemCtx = oEvent.getSource().getBindingContext("absencesModel");
          var oAbsenceData = oItemCtx.getObject();
          var sDocId = oAbsenceData.docId;
          var sCollection = oAbsenceData._collection || "Abwesenheiten";

          if (!sDocId) {
            MessageToast.show("Fehler: Keine Dokumenten-ID gefunden.");
            return;
          }

          firebase.db
            .collection(sCollection)
            .doc(sDocId)
            .update({ Status: "Genehmigt" })
            .then(() => {
              MessageToast.show("Antrag wurde genehmigt.");
              this._loadAbsences();
            })
            .catch((error) => {
              console.error("Fehler beim Genehmigen:", error);
              MessageToast.show("Fehler beim Genehmigen.");
            });
        },

        onRejectAbsence: function (oEvent) {
          var oItemCtx = oEvent.getSource().getBindingContext("absencesModel");
          var oAbsenceData = oItemCtx.getObject();
          var sDocId = oAbsenceData.docId;
          var sCollection = oAbsenceData._collection || "Abwesenheiten";

          if (!sDocId) {
            MessageToast.show("Fehler: Keine Dokumenten-ID gefunden.");
            return;
          }

          firebase.db
            .collection(sCollection)
            .doc(sDocId)
            .update({ Status: "Abgelehnt" })
            .then(() => {
              MessageToast.show("Antrag wurde abgelehnt.");
              this._loadAbsences();
            })
            .catch((error) => {
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
