sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.EmployeeDirectory", {
      onInit: function () {
        // Beim Start des Controllers die Daten laden
        this._loadEmployeeData();
      },

      /**
       * Lädt alle Mitarbeiterdaten inkl. Rollen aus Firestore
       * und speichert sie in einem JSONModel namens 'employees'.
       */
      _loadEmployeeData: function () {
        var that = this;
        var db = firebase.db;

        db.collection("DatenZurPerson")
          .get()
          .then(function (querySnapshot) {
            var aEmployees = [];
            querySnapshot.forEach(function (doc) {
              var oEmp = doc.data();
              aEmployees.push(oEmp);
            });

            var aPromises = aEmployees.map(function (oEmp) {
              return db
                .collection("StelleRolle")
                .where("Mitarbeiter-ID", "==", oEmp["Mitarbeiter-ID"])
                .get()
                .then(function (stelleRolleSnap) {
                  if (!stelleRolleSnap.empty) {
                    var oStelleRolleData = stelleRolleSnap.docs[0].data();
                    var sStellenId = oStelleRolleData["Stellen-ID"];

                    return db
                      .collection("Stelle")
                      .where("Stellen-ID", "==", sStellenId)
                      .get()
                      .then(function (stelleSnap) {
                        if (!stelleSnap.empty) {
                          var oStelleData = stelleSnap.docs[0].data();
                          oEmp.role = oStelleData["Stellenbezeichnung"];
                        } else {
                          oEmp.role = "";
                        }
                        return oEmp;
                      });
                  } else {
                    oEmp.role = "";
                    return oEmp;
                  }
                });
            });

            return Promise.all(aPromises);
          })
          .then(function (aEmployeesWithRoles) {
            var oModel = new JSONModel(aEmployeesWithRoles);
            that.getView().setModel(oModel, "employees");
          })
          .catch(function (error) {
            MessageToast.show("Fehler beim Laden der Mitarbeiterdaten.");
            console.error("Error fetching data: ", error);
          });
      },

      /**
       * Wird bei Änderung im SearchField (liveChange) aufgerufen.
       * - Wenn der String leer ist => Alle Daten anzeigen
       * - Ansonsten => Filtern
       */
      onSearchChanged: function (oEvent) {
        var sQuery = oEvent.getParameter("newValue") || "";
        // Wenn Feld leer => alles zurücksetzen
        if (!sQuery.trim()) {
          this.onResetSearch();
        } else {
          // Sonst filtern
          this.onSearchEmployee(oEvent);
        }
      },

      /**
       * Such-Event, das Filterlogik implemenetiert.
       * Filtern nach Name oder Rolle.
       */
      onSearchEmployee: function (oEvent) {
        var sQuery =
          oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
        sQuery = sQuery.toLowerCase();

        var oModel = this.getView().getModel("employees");
        if (!oModel) {
          MessageToast.show("Keine Mitarbeiterdaten vorhanden.");
          return;
        }

        var aAllEmployees = oModel.getData();
        if (!Array.isArray(aAllEmployees)) {
          return;
        }

        // Filtern nach Name oder Rolle
        var aFiltered = aAllEmployees.filter(function (oEmp) {
          var sName = (
            (oEmp.Vorname || "") +
            " " +
            (oEmp.Nachname || "")
          ).toLowerCase();
          var sRole = (oEmp.role || "").toLowerCase();

          return sName.indexOf(sQuery) !== -1 || sRole.indexOf(sQuery) !== -1;
        });

        oModel.setData(aFiltered);
      },

      
      //Zeigt wieder alle Daten an, indem wir sie neu geladen werden
       
      onResetSearch: function () {
        this._loadEmployeeData();
      },
    });
  }
);
