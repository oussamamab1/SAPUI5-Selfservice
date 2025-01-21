sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, MessageToast, JSONModel, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.Learning.Quiz", {
      onInit: function () {
        this._checkQuizStatus();
      },

      _checkQuizStatus: function () {
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          MessageToast.show("Bitte zuerst einloggen.");
          this.getOwnerComponent().getRouter().navTo("Main");
          return;
        }

        var sMitarbeiterID = oUserModel.getProperty("/Mitarbeiter-ID");

        firebase.db
          .collection("BestandeneQuizzes")
          .where("MitarbeiterID", "==", sMitarbeiterID)
          .get()
          .then(
            function (querySnapshot) {
              if (!querySnapshot.empty) {
                MessageToast.show("Sie haben den Quiz bereits bestanden.");
                this.getView().byId("quizContent").setVisible(false);
                this.getView().byId("btnSubmitQuiz").setVisible(false);
                this.getView()
                  .byId("quizResult")
                  .setText(
                    "Quiz abgeschlossen. Keine erneute Teilnahme erforderlich."
                  );
                this.getView().byId("quizResult").setVisible(true);
              } else {
                this._loadQuiz();
              }
            }.bind(this)
          )
          .catch(function (error) {
            console.error("Fehler beim Überprüfen des Quiz-Status:", error);
          });
      },

      _loadQuiz: function () {
        var oModel = new JSONModel();
        oModel.loadData("../model/learningModel.json");
        this.getView().setModel(oModel, "quiz");

        oModel.attachRequestCompleted(
          function () {
            this._checkModuleCompletion();
          }.bind(this)
        );

        oModel.attachRequestFailed(function () {
          MessageToast.show("Fehler ist aufgetreten.......");
        });
      },

      _checkModuleCompletion: function () {
        var bAlleModuleAbgeschlossen = this._sindAlleModuleAbgeschlossen();
        if (!bAlleModuleAbgeschlossen) {
          MessageToast.show(
            "Bitte absolvieren Sie zuerst alle Module, bevor Sie den Quiz starten."
          );
          this.getView().byId("quizContent").setVisible(false);
          this.getView().byId("btnSubmitQuiz").setVisible(false);
        } else {
          this._buildQuiz();
          this.getView().byId("quizContent").setVisible(true);
          this.getView().byId("btnSubmitQuiz").setVisible(true);
        }
      },

      _sindAlleModuleAbgeschlossen: function () {
        return true;
      },

      _buildQuiz: function () {
        var oQuizContent = this.getView().byId("quizContent");
        var aFragen = this.getView().getModel("quiz").getProperty("/questions");

        if (!aFragen || aFragen.length === 0) {
          console.error("Keine Fragen im Quiz gefunden.");
          return;
        }

        this._aRadioGroups = [];
        aFragen.forEach(
          function (frage, index) {
            var oVBox = new sap.m.VBox({ class: "sapUiSmallMarginBottom" });

            oVBox.addItem(
              new sap.m.Text({
                text: index + 1 + ". " + frage.question,
                wrapping: true,
              })
            );

            var oRadioGroup = new sap.m.RadioButtonGroup({
              columns: 1,
              selectedIndex: -1,
              buttons: frage.options.map(function (option) {
                return new sap.m.RadioButton({ text: option });
              }),
            });

            this._aRadioGroups.push(oRadioGroup);
            oVBox.addItem(oRadioGroup);
            oQuizContent.addItem(oVBox);
          }.bind(this)
        );
      },

      onSubmitQuiz: function () {
        var bAlleValid = true;

        this._aRadioGroups.forEach(function (oRadioGroup) {
          if (oRadioGroup.getSelectedIndex() === -1) {
            bAlleValid = false;
            oRadioGroup.addStyleClass("sapUiInvalid");
          } else {
            oRadioGroup.removeStyleClass("sapUiInvalid");
          }
        });

        if (!bAlleValid) {
          MessageToast.show(
            "Bitte beantworten Sie alle Fragen, bevor Sie den Quiz abschließen."
          );
          return;
        }

        var oQuizContent = this.getView().byId("quizContent");
        var aFragen = this.getView().getModel("quiz").getProperty("/questions");
        var iRichtig = 0;
        var aItems = oQuizContent.getItems();

        aItems.forEach(function (oVBox, index) {
          var oRadioGroup = oVBox.getItems()[1];
          var iSelectedIndex = oRadioGroup.getSelectedIndex();
          if (iSelectedIndex === aFragen[index].correct) {
            iRichtig++;
          }
        });

        var iTotal = aFragen.length;
        var iProzent = Math.round((iRichtig / iTotal) * 100);

        if (iProzent >= 80) {
          this._beiQuizErfolgSpeichern(iProzent);
        } else {
          this._beiQuizFehlschlag(iProzent);
        }
      },

      _beiQuizErfolgSpeichern: function (iProzent) {
        MessageToast.show(
          "Herzlichen Glückwunsch! Sie haben mit " + iProzent + "% bestanden."
        );

        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          console.error("Benutzermodell nicht gefunden.");
          return;
        }

        var sMitarbeiterID = oUserModel.getProperty("/Mitarbeiter-ID");

        var oBestandenDaten = {
          MitarbeiterID: sMitarbeiterID,
          Prozent: iProzent,
        };

        firebase.db
          .collection("BestandeneQuizzes")
          .add(oBestandenDaten)
          .then(
            function () {
              console.log(
                "Quiz-Ergebnis erfolgreich gespeichert:",
                oBestandenDaten
              );
              this.getView().byId("quizContent").setVisible(false);
              this.getView().byId("btnSubmitQuiz").setVisible(false);
              this.getView()
                .byId("quizResult")
                .setText(
                  "Sie haben mit " +
                    iProzent +
                    "% bestanden. Der Quiz ist abgeschlossen."
                );
              this.getView().byId("quizResult").setVisible(true);
            }.bind(this)
          )
          .catch(function (error) {
            console.error("Fehler beim Speichern des Quiz-Ergebnisses:", error);
          });
      },

      _beiQuizFehlschlag: function (iProzent) {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("FailurePage", {
          prozent: iProzent,
        });
      },

      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Modules");
      },
    });
  }
);
