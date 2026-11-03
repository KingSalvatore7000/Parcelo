"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parcelRoutes = void 0;
const express_1 = require("express");
const shared_1 = require("@thapal/shared");
const parcels_controller_1 = require("./parcels.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// All parcel routes require authentication and society scoping
router.use(auth_1.authenticate, auth_1.enforceSocietyScope);
// List parcels (scoped by role inside the controller)
router.get('/', (req, res, next) => parcels_controller_1.parcelsController.getParcels(req, res, next));
// Guard logs incoming parcel
router.post('/', (0, auth_1.requireRole)(shared_1.UserRole.GUARD, shared_1.UserRole.ADMIN), (req, res, next) => parcels_controller_1.parcelsController.createParcel(req, res, next));
// Upload parcel photo
router.post('/upload-photo', (0, auth_1.requireRole)(shared_1.UserRole.GUARD, shared_1.UserRole.ADMIN), (req, res, next) => parcels_controller_1.parcelsController.uploadPhoto(req, res, next));
// Single parcel details
router.get('/:id', (req, res, next) => parcels_controller_1.parcelsController.getParcelById(req, res, next));
// Guard verifies 4-digit code and completes handover
router.post('/:id/handover', (0, auth_1.requireRole)(shared_1.UserRole.GUARD, shared_1.UserRole.ADMIN), (req, res, next) => parcels_controller_1.parcelsController.completeHandover(req, res, next));
// Resident schedules pickup mode + slot (generates 4-digit code)
router.post('/:id/schedule', (0, auth_1.requireRole)(shared_1.UserRole.RESIDENT, shared_1.UserRole.ADMIN), (req, res, next) => parcels_controller_1.parcelsController.scheduleParcel(req, res, next));
exports.parcelRoutes = router;
//# sourceMappingURL=parcels.routes.js.map