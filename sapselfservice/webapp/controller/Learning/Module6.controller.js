sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
    'use strict';
    return Controller.extend('sapselfservice.controller.Learning.Module6', {
        onNavBack: function () {
            sap.ui.core.UIComponent.getRouterFor(this).navTo('Modules');
        }
    });
});
