sap.ui.define(['sap/ui/core/mvc/Controller', 'sap/ui/core/UIComponent'], function (Controller, UIComponent) {
    'use strict';
    return Controller.extend('sapselfservice.controller.Learning.Modules', {
        onInit: function () {
            
        },

        onModule1Press: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Module1');
        },

        onModule2Press: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Module2');
        },

        onModule3Press: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Module3');
        },

        onModule4Press: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Module4');
        },

        onModule5Press: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Module5');
        },

        onModule6Press: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Module6');
        },

        onQuizPress: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo('Quiz');
        },
        onNavBack: function () {
                sap.ui.core.UIComponent.getRouterFor(this).navTo('Main');
            }
    });
});
