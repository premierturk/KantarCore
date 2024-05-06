"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = require("axios");
var moment = require("moment");
var instance = axios_1.default.create({
    baseURL: '/Security.WebApi/',
    headers: { 'X-Custom-Header': 'foobar' }
});
function handleDates(body) {
    if (body === null || body === undefined || typeof body !== 'object') {
        return body;
    }
    if (!Array.isArray(body)) {
        return body;
    }
    // tslint:disable-next-line:only-arrow-functions
    body.forEach(function (item) {
        for (var _i = 0, _a = Object.keys(item); _i < _a.length; _i++) {
            var key = _a[_i];
            var value = item[key];
            var isDate = moment(value, 'DD-MM-YYYY', true).isValid();
            if (isDate) {
                item[key] = new Date(value);
            }
            else if (typeof value === 'object') {
                handleDates(value);
            }
        }
    });
}
// tslint:disable-next-line:only-arrow-functions
instance.interceptors.response.use(function (response) {
    if (response.data.data !== undefined) {
        handleDates(response.data.data);
    }
    return response;
    // tslint:disable-next-line:only-arrow-functions
}, function (error) {
    return Promise.reject(error);
});
var strUser = window.localStorage.getItem('user');
if (strUser !== null) {
  var user = JSON.parse(strUser);
  
    instance.defaults.headers.common.Authorization = user.token;
}
exports.default = instance;
//# sourceMappingURL=http-client.js.map
