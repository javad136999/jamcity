export type City = {
  id: string;
  name: string;
  slug: string;
  center_lat: number;
  center_lng: number;
  zoom: number;
  min_zoom: number;
  max_zoom: number;
  south_lat: number;
  west_lng: number;
  north_lat: number;
  east_lng: number;
  is_active: boolean;
};

export const FALLBACK_JAM_CITY: City = {
  id: "",
  name: "جم",
  slug: "jam",
  center_lat: 27.8194,
  center_lng: 52.3242,
  zoom: 14,
  min_zoom: 10,
  max_zoom: 18,
  south_lat: 27.78,
  west_lng: 52.27,
  north_lat: 27.87,
  east_lng: 52.38,
  is_active: true,
};

export function cityBounds(city: City): [[number, number], [number, number]] {
  return [
    [city.south_lat, city.west_lng],
    [city.north_lat, city.east_lng],
  ];
}
