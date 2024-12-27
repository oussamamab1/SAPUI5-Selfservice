sap.ui.define(['sap/ui/core/mvc/Controller', 'sap/m/MessageToast'], function (Controller, MessageToast) {
    'use strict';

    return Controller.extend('sapselfservice.controller.AbsenceOverview', {
        /**
         * Handler für "Neuer Abwesenheitsantrag"
         */
        onNewAbsenceRequest: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            if (!oRouter) {
                console.error('Router konnte nicht geladen werden!');
            } else {
                oRouter.navTo('newAbsenceRequest');
            }
        },
        onNavBack: function () {
            sap.ui.core.UIComponent.getRouterFor(this).navTo('Main');
        }
    });
});
