import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Known H24Voyages destination IDs discovered by probing the API.
// city names match exactly what the API returns in hotel.city.
const DESTINATIONS = [
  { id: 8,  city: "Tunis",    country: "Tunisie" },
  { id: 12, city: "Sousse",   country: "Tunisie" },
  { id: 13, city: "Djerba",   country: "Tunisie" },
  { id: 11, city: "Monastir", country: "Tunisie" },
  { id: 14, city: "Mahdia",   country: "Tunisie" },
  { id: 20, city: "Tabarka",  country: "Tunisie" },
  { id: 15, city: "Gammarth", country: "Tunisie" },
  { id: 7,  city: "Nabeul",   country: "Tunisie" },
  { id: 90, city: "Hammamet", country: "Tunisie" },
  { id: 16, city: "Zarzis",   country: "Tunisie" },
].map((d) => ({ ...d, label: `${d.city}, ${d.country}` }));

router.get("/destinations", (_req, res) => {
  res.json(DESTINATIONS);
});

export { DESTINATIONS };
export default router;
