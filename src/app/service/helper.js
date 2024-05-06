"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Helper = /** @class */ (function () {
    function Helper() {
    }
    Helper.openModal = function (modalService, content) {
        var modalRef = modalService.open(content, {
            size: 'lg',
            backdrop: 'static',
            windowClass: 'animated slideInDown',
            centered: false
        });
        return modalRef;
    };
    return Helper;
}());
exports.default = Helper;
//# sourceMappingURL=helper.js.map