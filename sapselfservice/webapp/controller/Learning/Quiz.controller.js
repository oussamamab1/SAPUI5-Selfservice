sap.ui.define(
    ['sap/ui/core/mvc/Controller', 'sap/m/MessageToast', 'sap/ui/model/json/JSONModel'],
    function (Controller, MessageToast, JSONModel) {
        'use strict';
        return Controller.extend('sapselfservice.controller.Learning.Quiz', {
            onInit: function () {
                var oModel = new JSONModel();
                oModel.loadData('../model/learningModel.json');
                this.getView().setModel(oModel, 'quiz');

                // Warte auf das vollständige Laden des Modells
                oModel.attachRequestCompleted(
                    function () {
                        this._checkModuleCompletion();
                    }.bind(this)
                );

                oModel.attachRequestFailed(function () {
                    MessageToast.show('Fehler ist aufgetreten.......');
                });
            },

            _checkModuleCompletion: function () {
                // Prüfen, ob alle Module abgeschlossen sind, ist noch nicht implementiert
                var bAllModulesCompleted = this._areAllModulesCompleted();
                if (!bAllModulesCompleted) {
                    MessageToast.show('Bitte absolvieren Sie zuerst alle Module, bevor Sie den Quiz starten.');
                    this.getView().byId('quizContent').setVisible(false);
                    this.getView().byId('btnSubmitQuiz').setVisible(false);
                } else {
                    this._buildQuiz();
                    this.getView().byId('quizContent').setVisible(true);
                    this.getView().byId('btnSubmitQuiz').setVisible(true);
                }
            },

            _areAllModulesCompleted: function () {
               
                // TO DO: überprüfen ob alle Module abgeschlossen wurden? Button in jedem Modul oder ein Timeout?? noch nicht entschieden.
                return true;
            },

           _buildQuiz: function () {
    var oQuizContent = this.getView().byId('quizContent');
    var aQuestions = this.getView().getModel('quiz').getProperty('/questions');

    if (!aQuestions || aQuestions.length === 0) {
        console.error('Keine Fragen im Quiz gefunden.');
        return;
    }

    // Array zum Speichern der RadioButtonGroup-Referenzen
    this._aRadioGroups = [];

    aQuestions.forEach(function (question, index) {
        var oVBox = new sap.m.VBox({ class: 'sapUiSmallMarginBottom' });

        // Frage als Text hinzufügen
        oVBox.addItem(new sap.m.Text({ text: index + 1 + '. ' + question.question, wrapping: true }));

        // RadioButtonGroup erstellen
        var oRadioGroup = new sap.m.RadioButtonGroup({
            columns: 1,
            selectedIndex: -1, // Standardmäßig keine Auswahl
            buttons: question.options.map(function (option) {
                return new sap.m.RadioButton({ text: option });
            })
        });

        // RadioButtonGroup speichern
        this._aRadioGroups.push(oRadioGroup);

        // RadioButtonGroup zur VBox hinzufügen
        oVBox.addItem(oRadioGroup);
        oQuizContent.addItem(oVBox);
    }.bind(this));
},


          onSubmitQuiz: function () {
    var bAllValid = true;

    // Validierung der RadioButtonGroups
    this._aRadioGroups.forEach(function (oRadioGroup) {
        if (oRadioGroup.getSelectedIndex() === -1) {
            bAllValid = false;
            // Zeige einen visuellen Hinweis, dass die Auswahl erforderlich ist
            oRadioGroup.addStyleClass('sapUiInvalid'); // Beispiel einer CSS-Klasse
        } else {
            oRadioGroup.removeStyleClass('sapUiInvalid');
        }
    });

    // Falls nicht alle validiert sind, zeige eine Fehlermeldung und stoppe die Funktion
    if (!bAllValid) {
        sap.m.MessageToast.show('Bitte beantworten Sie alle Fragen, bevor Sie den Quiz abschließen.');
        return;
    }

    // Quiz-Berechnung
    var oQuizContent = this.getView().byId('quizContent');
    var aQuestions = this.getView().getModel('quiz').getProperty('/questions');
    var iCorrect = 0;
    var aItems = oQuizContent.getItems();

    aItems.forEach(function (oVBox, index) {
        var oRadioGroup = oVBox.getItems()[1];
        var iSelectedIndex = oRadioGroup.getSelectedIndex();
        if (iSelectedIndex === aQuestions[index].correct) {
            iCorrect++;
        }
    });

    var iTotal = aQuestions.length;
    var iPercentage = Math.round((iCorrect / iTotal) * 100);

    if (iPercentage >= 80) {
        this._onQuizSuccess(iPercentage);
    } else {
        this._onQuizFailure(iPercentage);
    }
},


            _onQuizSuccess: function (iPercentage) {
                MessageToast.show('Herzlichen Glückwunsch! Sie haben mit ' + iPercentage + '% bestanden.');
                this.getView().byId('quizContent').setVisible(false);
                this.getView().byId('btnSubmitQuiz').setVisible(false);
                this.getView()
                    .byId('quizResult')
                    .setText('Sie haben mit ' + iPercentage + '% bestanden. Der Quiz ist abgeschlossen.');
                this.getView().byId('quizResult').setVisible(true);
            },

            _onQuizFailure: function (iPercentage) {
                
                sap.ui.core.UIComponent.getRouterFor(this).navTo('FailurePage', {
                    percentage: iPercentage
                });
            },

            onNavBack: function () {
                sap.ui.core.UIComponent.getRouterFor(this).navTo('Modules');
            }
        });
    }
);
