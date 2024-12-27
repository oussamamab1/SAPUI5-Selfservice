sap.ui.define(
    ['sap/ui/core/mvc/Controller', 'sap/m/MessageToast', 'sap/ui/core/format/DateFormat'],
    function (Controller, MessageToast, DateFormat) {
        'use strict';

        return Controller.extend('sapselfservice.controller.TimeCorrections', {
            onInit: function () {
                try {
                    var oView = this.getView();

                    // Heutiges Datum setzen
                    var oDatePicker = oView.byId('datePicker');
                    var today = new Date();
                    oDatePicker.setDateValue(today);

                    // Aktuelle Zeit setzen
                    var oTimePicker = oView.byId('timePicker');
                    var now = DateFormat.getTimeInstance({ pattern: 'HH:mm' }).format(new Date());
                    oTimePicker.setValue(now);
                } catch (e) {
                    console.error('Fehler bei der Initialisierung:', e);
                }
            },

            onSaveTimeCorrection: function () {
                try {
                    var oView = this.getView();
                    var oSegmentedButton = oView.byId('correctionTypeSelect');
                    var selectedButton = oSegmentedButton.getSelectedButton(); // Abgerufene Button-ID
                    var correctionType = sap.ui.getCore().byId(selectedButton).getText(); // Text als Identifikation
                    var date = oView.byId('datePicker').getValue();
                    var time = oView.byId('timePicker').getValue();

                    // Validierung
                    if (!date || !time) {
                        MessageToast.show('Bitte Datum und Zeit eingeben!');
                        return;
                    }

                    // Unterschiedliche Logik für "Kommen" und "Gehen"
                    if (correctionType === 'Kommen') {
                        MessageToast.show('Kommen erfasst: Datum: ' + date + ', Zeit: ' + time);
                        console.log('Kommen erfasst: Datum:', date, ', Zeit:', time);
                    } else if (correctionType === 'Gehen') {
                        MessageToast.show('Gehen erfasst: Datum: ' + date + ', Zeit: ' + time);
                        console.log('Gehen erfasst: Datum:', date, ', Zeit:', time);
                    }
                } catch (e) {
                    console.error('Fehler beim Speichern der Zeitkorrektur:', e);
                    MessageToast.show('Fehler beim Speichern der Zeitkorrektur.');
                }
            },

            onCancelTimeCorrection: function () {
                try {
                    var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                    oRouter.navTo('Main'); // Navigiere zurück zur Startseite
                    console.log("geklickt");
                } catch (e) {
                    console.error('Fehler bei der Navigation zurück:', e);
                    MessageToast.show('Fehler bei der Navigation.');
                }
            }
        });
    }
);
