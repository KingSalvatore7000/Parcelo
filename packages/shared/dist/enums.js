"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_COURIERS = exports.NotificationStatus = exports.NotificationChannel = exports.HandoverMode = exports.ParcelStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["RESIDENT"] = "RESIDENT";
    UserRole["GUARD"] = "GUARD";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var ParcelStatus;
(function (ParcelStatus) {
    ParcelStatus["LOGGED"] = "LOGGED";
    ParcelStatus["SCHEDULED"] = "SCHEDULED";
    ParcelStatus["HANDED_OVER"] = "HANDED_OVER";
    ParcelStatus["UNCLAIMED"] = "UNCLAIMED";
    ParcelStatus["RETURNED"] = "RETURNED";
})(ParcelStatus || (exports.ParcelStatus = ParcelStatus = {}));
var HandoverMode;
(function (HandoverMode) {
    HandoverMode["PICKUP"] = "PICKUP";
    HandoverMode["DOOR"] = "DOOR";
})(HandoverMode || (exports.HandoverMode = HandoverMode = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["PUSH"] = "PUSH";
    NotificationChannel["WHATSAPP"] = "WHATSAPP";
    NotificationChannel["SMS"] = "SMS";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "PENDING";
    NotificationStatus["SENT"] = "SENT";
    NotificationStatus["FAILED"] = "FAILED";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
exports.COMMON_COURIERS = [
    'Amazon',
    'Flipkart',
    'Blue Dart',
    'Delhivery',
    'DTDC',
    'India Post',
    'Swiggy Instamart',
    'Blinkit',
    'Zepto',
    'Myntra',
    'DHL',
    'FedEx',
    'Other',
];
//# sourceMappingURL=enums.js.map