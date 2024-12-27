sap.ui.define(
    ['sap/ui/core/mvc/Controller', 'sap/ui/model/json/JSONModel', 'sap/m/MessageToast'],
    function (Controller, JSONModel, MessageToast) {
        'use strict';

        return Controller.extend('sapselfservice.controller.PayStatements', {
            onInit: function () {
                var sPdfFolder = '../paystatements/';

            
                var aPayStatements = [
                    { date: '2024-12', fileName: 'Dezember_2024.pdf' },
                    { date: '2024-11', fileName: 'November_2024.pdf' },
                    { date: '2024-10', fileName: 'Oktober_2024.pdf' },
                    { date: '2024-09', fileName: 'September_2024.pdf' }
                ].map(function (item) {
                    item.filePath = sPdfFolder + item.fileName;
                    return item;
                });

                var oModel = new JSONModel({
                    payStatements: aPayStatements,
                    filteredPayStatements: [] 
                });

                this.getView().setModel(oModel, 'payStatements');

        
                this._applyDefaultFilter();
                
                console.log('Initialisiere Modell...');
                console.log(this.getView().getModel('payStatements').getProperty('/payStatements'));
                console.log(this.getView().getModel('payStatements').getProperty('/filteredPayStatements'));


            },

            _applyDefaultFilter: function () {
                var oModel = this.getView().getModel('payStatements');
                var aPayStatements = oModel.getProperty('/payStatements');

                if (!aPayStatements || aPayStatements.length === 0) {
                    console.error('Keine Lohnabrechnungen im Modell gefunden.');
                    return;
                }

                aPayStatements.sort(function (a, b) {
                    return new Date(b.date) - new Date(a.date);
                });

          
                oModel.setProperty('/filteredPayStatements', aPayStatements);

                console.log('Gefilterte Daten:', oModel.getProperty('/filteredPayStatements'));
            },
            onFilterChange: function () {
                var oView = this.getView();
                var oModel = oView.getModel('payStatements');

                var sMonth = oView.byId('monthSelect').getSelectedKey();
                var sYear = oView.byId('yearInput').getValue();

                if (!sYear || isNaN(sYear)) {
                    MessageToast.show('Bitte geben Sie ein gültiges Jahr ein.');
                    return;
                }

              
                var aPayStatements = oModel.getProperty('/payStatements');
                var aFiltered = aPayStatements.filter(function (statement) {
                    var [year, month] = statement.date.split('-');
                    return year === sYear && (!sMonth || parseInt(month, 10) === parseInt(sMonth, 10));
                });

                if (aFiltered.length === 0) {
                    MessageToast.show('Keine Lohnabrechnungen für die angegebenen Filter gefunden.');
                }

                oModel.setProperty('/filteredPayStatements', aFiltered);
            },

            onPayStatementViewPress: function (oEvent) {
                var oButton = oEvent.getSource();
                var oContext = oButton.getBindingContext('payStatements');

                if (!oContext) {
                    console.error('BindingContext ist undefined. Überprüfen Sie das Modell und die Bindungen.');
                    MessageToast.show('Fehler: Keine Daten gefunden.');
                    return;
                }

                var sFilePath = oContext.getProperty('filePath');

                if (!sFilePath) {
                    console.error('filePath ist undefined.');
                    MessageToast.show('Fehler: Die Datei konnte nicht gefunden werden.');
                    return;
                }

                // Öffne die PDF-Datei in einem neuen Tab
                window.open(sFilePath, '_blank');
            },
            onResetFilter: function () {
    var oView = this.getView();
    var oModel = oView.getModel('payStatements');

    oView.byId('monthSelect').setSelectedKey("");
    oView.byId('yearInput').setValue("");


    var aPayStatements = oModel.getProperty('/payStatements');
    oModel.setProperty('/filteredPayStatements', aPayStatements);

    MessageToast.show('Filter wurde zurückgesetzt.');
}
,
            onNavBack: function () {
                sap.ui.core.UIComponent.getRouterFor(this).navTo('Main');
            }
        });
    }
);
