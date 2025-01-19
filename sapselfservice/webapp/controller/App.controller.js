sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("sapselfservice.controller.App", {
        onInit: function() {
          this.getOwnerComponent().getRouter().initialize();
        }
      });
    }
  );
  