sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
  ],
  function (Controller, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("sapselfservice.controller.TaxStatements", {
      onInit: function () {
        // Initialize model
        var oModel = new JSONModel({
          taxStatements: [],
          filteredTaxStatements: [],
        });
        this.getView().setModel(oModel, "taxStatements");

        this._loadTaxStatements();
      },

     
      _loadTaxStatements: function () {
        var oModel = this.getView().getModel("taxStatements");
        var currentYear = new Date().getFullYear()-1;

        
        var aStatements = [];
        for (var i = 0; i < 4; i++) {
          var year = currentYear - i;
          aStatements.push({
            year: year.toString(),
            filePath: `../taxstatements/Lohnsteuer_${year}.pdf`,
          });
        }

        oModel.setProperty("/taxStatements", aStatements);
        oModel.setProperty("/filteredTaxStatements", aStatements);
        
        // Populate year dropdown
        var oYearSelect = this.getView().byId("yearSelect");
        aStatements.forEach(function (statement) {
          oYearSelect.addItem(
            new sap.ui.core.Item({ key: statement.year, text: statement.year })
          );
        });
      },

     
      onFilterChange: function () {
        var oView = this.getView();
        var oModel = oView.getModel("taxStatements");

        var sSelectedYear = oView.byId("yearSelect").getSelectedKey();
        if (!sSelectedYear) {
          MessageToast.show("Bitte wählen Sie ein Jahr aus.");
          return;
        }

        
        var aTaxStatements = oModel.getProperty("/taxStatements");
        var aFiltered = aTaxStatements.filter(function (item) {
          return item.year === sSelectedYear;
        });

        oModel.setProperty("/filteredTaxStatements", aFiltered);
        if (aFiltered.length === 0) {
          MessageToast.show(
            "Keine Lohnsteuerbescheinigungen für das gewählte Jahr gefunden."
          );
        }
      },

      
      onResetFilter: function () {
        var oView = this.getView();
        var oModel = oView.getModel("taxStatements");

        oView.byId("yearSelect").setSelectedKey(null);
        oModel.setProperty(
          "/filteredTaxStatements",
          oModel.getProperty("/taxStatements")
        );

        MessageToast.show("Filter wurde zurückgesetzt.");
      },

      
      onTaxStatementViewPress: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("taxStatements");
        if (!oContext) {
          MessageToast.show("Fehler: Keine Daten gefunden.");
          return;
        }

        var sFilePath = oContext.getProperty("filePath");
        if (!sFilePath) {
          MessageToast.show("Fehler: Die Datei konnte nicht gefunden werden.");
          return;
        }

      
        var oPdfPanel = this.getView().byId("pdfPreviewPanel");
        var oPdfFrame = this.getView().byId("pdfPreviewFrame");
        oPdfFrame.setContent(
          `<iframe src="${sFilePath}" style="width:100%; height:800px; border:none;"></iframe>`
        );

        oPdfPanel.setVisible(true);
      },

     
      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
  }
);
