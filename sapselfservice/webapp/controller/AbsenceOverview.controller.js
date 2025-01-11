sap.ui.define(['sap/ui/core/mvc/Controller', 

    'sap/ui/model/json/JSONModel',
    "sapselfservice/backend/firebase"

], function (Controller, JSONModel, firebase) {
    'use strict';

    return Controller.extend('sapselfservice.controller.AbsenceOverview', {
        onInit: function () {
            var oUserModel = sap.ui.getCore().getModel("userModel");
        
            if (!oUserModel) {
                sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
                this.getOwnerComponent().getRouter().navTo("login");
                return;
            }
        
            var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
        
            const abwesenheitenPromise = this.fetchAbwesenheiten(mitarbeiterId);
            const urlaubsplanPromise = this.fetchUrlaubsplan(mitarbeiterId);
        
            Promise.all([abwesenheitenPromise, urlaubsplanPromise]).then(results => {
                const combinedEntries = [].concat(...results);
        
                function fetchAbwesenheitsart(abwesenheitId) {
                    return firebase.db.collection("Abwesenheitsart")
                        .where("Abwesenheit-ID", "==", abwesenheitId)
                        .get()
                        .then(querySnapshot => {
                            if (querySnapshot.empty) {
                                return "Unbekannt";
                            }
                            const description = querySnapshot.docs[0].data().Beschreibung;
                            return description;
                        })
                        .catch(error => {
                            return "Unbekannt";
                        });
                }
        
                const updatedEntries = combinedEntries.map(entry => {
                    const abwesenheitId = entry["Abwesenheit-ID"];
                    return fetchAbwesenheitsart(abwesenheitId).then(beschreibung => {
                        entry.AbwesenheitsartBeschreibung = beschreibung;
                        return entry;
                    }).catch(error => {
                        entry.AbwesenheitsartBeschreibung = "Unbekannt";
                        return entry;
                    });
                });
        
                Promise.all(updatedEntries).then(processedEntries => {
                    processedEntries.forEach(entry => {
                        if (entry.Antragsdatum && entry.Antragsdatum.seconds) {
                            const date = new Date(entry.Antragsdatum.seconds * 1000);
                            entry.Antragsdatum = date.toLocaleDateString("en-GB", {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                            });
                        }
                    });
        
                    processedEntries.sort((a, b) => {
                        return b.Antragsdatum - a.Antragsdatum;
                    });
        
                    const oModel = new sap.ui.model.json.JSONModel();
                    oModel.setData({ entries: processedEntries });
                    this.getView().setModel(oModel, "AbwesenceModel");
                }).catch(error => {
                    console.error("Error processing updated entries:", error);
                });
        
            }).catch(error => {
                console.error("Error combining data:", error);
            });
        }
        ,
        
        
        
        //fetch Abwesenheiten data
        fetchAbwesenheiten: function (mitarbeiterId) {
            return firebase.db
                .collection("Abwesenheiten")
                .where("Mitarbeiter-ID", "==", mitarbeiterId)
                .get()
                .then(querySnapshot => {
                    const abwesenheiten = [];
                    querySnapshot.forEach(doc => {
                        abwesenheiten.push(doc.data());
                        console.log("Abwesenheiten Document Data:", doc.data());
                    });
                    return abwesenheiten;
                })
                .catch(error => {
                    console.error("Error fetching Abwesenheiten documents:", error);
                    return [];
                });
        },
        
        //fetch Urlaubsplan data
        fetchUrlaubsplan: function (mitarbeiterId) {
            return firebase.db
                .collection("Urlaubsplan")
                .where("Mitarbeiter-ID", "==", mitarbeiterId)
                .get()
                .then(querySnapshot => {
                    const urlaubsplan = [];
                    querySnapshot.forEach(doc => {
                        urlaubsplan.push(doc.data());
                        console.log("Urlaubsplan Document Data:", doc.data());
                    });
                    return urlaubsplan;
                })
                .catch(error => {
                    console.error("Error fetching Urlaubsplan documents:", error);
                    return [];
                });
        },
               
        
        
        onNewAbsenceRequest: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            if (!oRouter) {
                console.error('Router konnte nicht geladen werden!');
            } else {
                oRouter.navTo('newAbsenceRequest');
            }
        },
        onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
});
