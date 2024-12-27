sap.ui.define(
    ['sap/ui/core/mvc/Controller', 'sap/m/MessageToast', 'sap/ui/core/UIComponent'],
    function (Controller, MessageToast, UIComponent) {
        'use strict';

        return Controller.extend('sapselfservice.controller.NewAbsenceRequest', {
            onInit: function () {
                // Beispiel-Datenmodell für Abwesenheitstypen
                var oModel = new sap.ui.model.json.JSONModel({
                    AbsenceTypes: [
                        { typeId: '4510', typeName: 'Teleworking' },
                        { typeId: '4500', typeName: 'Teleworking (Wochenende)' },
                        { typeId: '0100', typeName: 'Urlaub' }
                    ]
                });
                this.getView().setModel(oModel);
            },

            onAbsenceTypeChange: function () {
                var oView = this.getView();
                var selectedType = oView.byId('absenceTypeSelect').getSelectedItem();
                var selectedText = selectedType ? selectedType.getText() : '';

                console.log('Ausgewählte Abwesenheitsart:', selectedText);

                if (selectedText === 'Urlaub') {
                    // Zeitfelder ausblenden
                    oView.byId('startTimeLabel').setVisible(false);
                    oView.byId('startTimePicker').setVisible(false);
                    oView.byId('endTimeLabel').setVisible(false);
                    oView.byId('endTimePicker').setVisible(false);
                    oView.byId('durationLabel').setVisible(false);
                    oView.byId('durationInput').setVisible(false);

                    // Urlaubstage anzeigen
                    oView.byId('endDateLabel').setVisible(true);
                    oView.byId('endDatePicker').setVisible(true);
                    oView.byId('vacationDaysLabel').setVisible(true);
                    oView.byId('vacationDaysInput').setVisible(true);
                } else if (selectedText === 'Teleworking' || selectedText === 'Teleworking (Wochenende)') {
                    // Zeitfelder anzeigen
                    oView.byId('startTimeLabel').setVisible(true);
                    oView.byId('startTimePicker').setVisible(true);
                    oView.byId('endTimeLabel').setVisible(true);
                    oView.byId('endTimePicker').setVisible(true);
                    oView.byId('durationLabel').setVisible(true);
                    oView.byId('durationInput').setVisible(true);

                    // Urlaubstage ausblenden
                    oView.byId('endDateLabel').setVisible(false);
                    oView.byId('endDatePicker').setVisible(false);
                    oView.byId('vacationDaysLabel').setVisible(false);
                    oView.byId('vacationDaysInput').setVisible(false);
                }
            },

            onDateChange: function () {
                var oView = this.getView();
                var sDate = oView.byId('datePicker').getValue();
                var sEndDate = oView.byId('endDatePicker').getValue();

                if (sDate && sEndDate) {
                    var s_date_day = sDate.substring(3, 5);
                    var s_date_month = sDate.substring(0, 2);
                    var s_date_year = sDate.substring(6);
                    var startDayFormat = '20' + s_date_year + '-' + s_date_month + '-' + s_date_day;
                    var startDate = new Date(startDayFormat.toString());

                    var e_date_day = sEndDate.substring(3, 5);
                    var e_date_month = sEndDate.substring(0, 2);
                    var e_date_year = sEndDate.substring(6);
                    var endDayFormat = '20' + e_date_year + '-' + e_date_month + '-' + e_date_day;
                    var endDate = new Date(endDayFormat.toString());

                    var totalDays = 0;

                    for (var d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        var chosenDay = d.getDay();
                        // Zähle nur Tage, die keine Wochenendtage sind (Montag bis Freitag)
                        if (chosenDay !== 0 && chosenDay !== 6) {
                            totalDays++;
                        }
                    }

                    console.log('Urlaubstage:', totalDays);

                    // Urlaubstage im UI anzeigen
                    oView.byId('vacationDaysInput').setValue(totalDays.toString());

                    // Kontingent überprüfen
                    var remainingQuota = parseInt(oView.byId('quotaInput').getValue(), 10);
                    if (totalDays > remainingQuota) {
                        MessageToast.show('Ihr Urlaubskontingent reicht nicht aus. Verfügbare Tage: ' + remainingQuota);
                    }
                }
            },
            onTimeChange: function () {
                var oView = this.getView();
                var sStartTime = oView.byId('startTimePicker').getValue();
                var sEndTime = oView.byId('endTimePicker').getValue();

                if (sStartTime && sEndTime) {
                    // Uhrzeit in 24-Stunden-Format umwandeln
                    var startTimeIn24Hr = this.convertTo24HourFormat(sStartTime);
                    var endTimeIn24Hr = this.convertTo24HourFormat(sEndTime);

                    // Berechnung der gearbeiteten Zeit
                    var workedHours =
                        parseInt(endTimeIn24Hr.substring(0, 2)) - parseInt(startTimeIn24Hr.substring(0, 2));
                    var workedMinutes =
                        parseInt(endTimeIn24Hr.substring(3, 5)) - parseInt(startTimeIn24Hr.substring(3, 5));
                    if (workedMinutes < 0) {
                        workedHours -= 1;
                        workedMinutes = 60 + workedMinutes;
                    }

                    // Ergebnis anzeigen
                    var durationString = `${workedHours.toString().padStart(2, '0')}:${workedMinutes
                        .toString()
                        .padStart(2, '0')}`;
                    oView.byId('durationInput').setValue(durationString);
                }
            },

            convertTo24HourFormat: function (time) {
                if (!time) return '';
                let [hours, minutes] = time.replace(/PM|AM$/i, '').split(':');
                hours = parseInt(hours, 10);
                if (/PM$/i.test(time) && hours !== 12) {
                    hours += 12; // PM -> 12 Stunden hinzufügen
                } else if (/AM$/i.test(time) && hours === 12) {
                    hours = 0; // 12 AM -> Mitternacht
                }
                return `${hours.toString().padStart(2, '0')}:${minutes}`;
            },

            onSaveRequest: function () {
                var oView = this.getView();
                var oSelectedType = oView.byId('absenceTypeSelect').getSelectedItem();
                var sDate = oView.byId('datePicker').getValue();
                var sEndDate = oView.byId('endDatePicker').getValue();
                var sStartTime = oView.byId('startTimePicker').getValue();
                var sEndTime = oView.byId('endTimePicker').getValue();
                var calculatedDays = parseInt(oView.byId('vacationDaysInput').getValue(), 10);
                var remainingQuota = parseInt(oView.byId('quotaInput').getValue(), 10);
                var sNote = oView.byId('noteTextArea').getValue();

                if (oSelectedType && oSelectedType.getText() === 'Urlaub') {
                    if (!sDate || !sEndDate) {
                        MessageToast.show('Bitte Start- und Enddatum eingeben!');
                        return;
                    }

                    if (calculatedDays > remainingQuota) {
                        MessageToast.show('Ihr Urlaubskontingent reicht nicht aus. Verfügbare Tage: ' + remainingQuota);
                        return;
                    }

                    MessageToast.show('Urlaub erfolgreich beantragt. Verbraucht: ' + calculatedDays + ' Tage.');
                    return;
                }
                var s_date_day = sDate.substring(3, 5);
                var s_date_month = sDate.substring(0, 2);
                var s_date_year = sDate.substring(6);
                var dayFormat = '20' + s_date_year + '-' + s_date_month + '-' + s_date_day;
                var chosenDay = new Date(dayFormat.toString()).getDay();

                console.log(chosenDay);

                // wenn "Teleworking" als Abwesenheitsart ausgewählt ist
                if (oSelectedType && oSelectedType.getText() === 'Teleworking') {
                    if (chosenDay === 0 || chosenDay === 6) {
                        MessageToast.show(
                            "Wenn Sie am Wochenende gearbeitet haben, bitte bei Art der Abwesenheit 'Teleworking Wochenende' auswählen."
                        );
                        return;
                    }
                }
                // wenn "Teleworking(wochenende)" als Abwesenheitsart ausgewählt ist
                if (oSelectedType && oSelectedType.getText() === 'Teleworking (Wochenende)') {
                    if (chosenDay !== 0 && chosenDay !== 6) {
                        MessageToast.show(
                            "Wenn Sie von Montag bis Freitag gearbeitet haben, bitte bei Art der Abwesenheit 'Teleworking' auswählen."
                        );
                        return;
                    }
                }
                // Bedingung: Alle Felder ausgefüllt
                if (!sDate || !oSelectedType || !sStartTime || !sEndTime) {
                    MessageToast.show('Bitte alle erforderlichen Felder ausfüllen!');
                    return;
                }

                MessageToast.show('Abwesenheitsantrag gespeichert!');
            },
            onCancelRequest: function () {
                try {
                    var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                    oRouter.navTo('Main'); // Navigiere zurück zur Startseite
                    console.log('geklickt');
                } catch (e) {
                    console.error('Fehler bei der Navigation zurück:', e);
                    MessageToast.show('Fehler bei der Navigation.');
                }
            }
        });
    }
);
