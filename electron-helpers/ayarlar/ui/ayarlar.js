var app = angular.module("myApp", []);
var ipcRenderer = require("electron").ipcRenderer;
app.controller("myCtrl", function ($scope) {
  $scope.kantarConfig = {};

  ipcRenderer.on("config", (event, data) => {
    console.log(data);
    $scope.kantarConfig = data;
    if (!$scope.kantarConfig.cameras) {
      $scope.kantarConfig.cameras = [];
    }
    $scope.$apply();
  });

  $scope.addCamera = function () {
    if (!$scope.kantarConfig.cameras) {
      $scope.kantarConfig.cameras = [];
    }
    $scope.kantarConfig.cameras.push({ name: "", url: "" });
  };

  $scope.removeCamera = function (index) {
    $scope.kantarConfig.cameras.splice(index, 1);
  };

  $scope.save = function () {
    if (
      ($scope.kantarConfig.reader || $scope.kantarConfig.antenseriport) &&
      $scope.kantarConfig.antenTip != "hopland"
    ) {
      alert(
        "ReaderApp veya ReaderAppSerialPort seçili ise anten tipi HOPLAND olmak zorundadır !"
      );
    } else {
      ipcRenderer.send("kantarConfig", $scope.kantarConfig);
      window.close();
    }
  };

  $scope.restart = function () {
    ipcRenderer.send("antenRestart");
  };
});
