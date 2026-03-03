import { Hono } from "hono";
import {
  getConsentStatus,
  grantConsent,
  revokeConsent,
} from "../controllers/consent-controller.js";

const consentRoutes = new Hono();

consentRoutes.get("/status", getConsentStatus);
consentRoutes.post("/grant", grantConsent);
consentRoutes.post("/revoke", revokeConsent);

export { consentRoutes };
