var app = angular.module("myApp", []);
var ipcRenderer = require("electron").ipcRenderer;
app.controller("myCtrl", function ($scope) {
  $scope.kantarConfig = {};

  ipcRenderer.on("config", (event, data) => {
    console.log(data);
    $scope.kantarConfig = data;
    $scope.$apply();
  });

  $scope.save = function () {
    ipcRenderer.send("kantarConfig", $scope.kantarConfig);
    window.close();
  };
});
