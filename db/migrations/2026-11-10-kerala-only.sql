-- Kerala-only catalogue with one original sample listing per category.
-- Run once (atomic). Removes every other city, locality, project, listing, lead and non-demo user.
-- Sample listings are ORIGINAL demo data (not copied from any site); prices and trends are illustrative.
BEGIN;

-- 1. Remove everything tied to the old cities/listings (demo data only)
TRUNCATE listings, projects, reviews, saved_searches, notifications, outbox, requirements, orders, reports RESTART IDENTITY CASCADE;
DELETE FROM audit_logs;
DELETE FROM price_trends;
UPDATE profiles SET city_id = NULL;
UPDATE articles SET city_id = NULL;
DELETE FROM localities;
DELETE FROM cities;
DELETE FROM users WHERE phone IS NULL OR phone NOT IN (
  '9000000001','9000000002','9000000003','9000000004','9000000005',
  '9876543210','9876543211','9876543212','9876543213');
DELETE FROM articles WHERE category = 'city-guide' OR slug LIKE 'stamp-duty-in-2026%'
  OR slug LIKE 'renting-in-bengaluru%' OR slug LIKE 'pune-s-hinjewadi%';

-- 2. Kerala cities
INSERT INTO cities (slug, name, state, lat, lng, is_launch, sort) VALUES
  ('kochi', 'Kochi', 'Kerala', 9.9312, 76.2673, 1, 0),
  ('thiruvananthapuram', 'Thiruvananthapuram', 'Kerala', 8.5241, 76.9366, 1, 1),
  ('kozhikode', 'Kozhikode', 'Kerala', 11.2588, 75.7804, 1, 2),
  ('thrissur', 'Thrissur', 'Kerala', 10.5276, 76.2144, 1, 3),
  ('kollam', 'Kollam', 'Kerala', 8.8932, 76.6141, 1, 4);

-- 3. Localities (psf = illustrative average price per sq ft used to build the trend series)
CREATE TEMP TABLE _loc (city text, slug text, name text, lat float8, lng float8, rating float8, conn float8, safety float8, life float8, trending int, psf int, descr text, landmarks text) ON COMMIT DROP;
INSERT INTO _loc VALUES
 ('kochi','kakkanad','Kakkanad',10.0159,76.3419,4.3,4.0,4.4,4.2,1,7200,'Kakkanad is Kochi''s IT corridor, home to Infopark and a large rental market of working professionals. Most housing is mid-rise apartments built in the last decade.','[{"name":"Infopark Kochi","kind":"it_park","lat":10.0094,"lng":76.3601}]'),
 ('kochi','edappally','Edappally',10.0261,76.3125,4.4,4.6,4.3,4.5,1,7800,'Edappally sits at the junction of the NH 66 bypass and the Kochi Metro line, with shopping, hospitals and schools within a short drive.','[{"name":"Lulu Mall Kochi","kind":"mall","lat":10.0270,"lng":76.3080},{"name":"Edappally Metro Station","kind":"metro","lat":10.0250,"lng":76.3086}]'),
 ('kochi','kalamassery','Kalamassery',10.0529,76.3177,4.0,4.2,4.1,3.8,0,5600,'Kalamassery combines industrial estates, CUSAT and the medical college. It suits families who want a quieter address within reach of the city and the airport.','[]'),
 ('kochi','panampilly-nagar','Panampilly Nagar',9.9609,76.2995,4.6,4.4,4.6,4.6,0,11500,'Panampilly Nagar is one of Kochi''s established residential neighbourhoods, close to the Marine Drive waterfront and the city''s main commercial streets.','[]'),
 ('thiruvananthapuram','kowdiar','Kowdiar',8.5185,76.9560,4.6,4.3,4.7,4.5,1,12500,'Kowdiar is the capital''s best-known premium residential area, with wide roads, large plots and independent homes close to the city centre.','[]'),
 ('thiruvananthapuram','kazhakkoottam','Kazhakkoottam',8.5679,76.8730,4.2,4.2,4.2,4.1,1,6500,'Kazhakkoottam is anchored by Technopark and is the main address for IT professionals in Thiruvananthapuram, with steady rental demand.','[{"name":"Technopark","kind":"it_park","lat":8.5584,"lng":76.8814}]'),
 ('thiruvananthapuram','pattom','Pattom',8.5240,76.9440,4.4,4.5,4.4,4.3,0,8200,'Pattom is a central, well-connected locality with schools, hospitals and offices close by.','[{"name":"Government Medical College Hospital","kind":"hospital","lat":8.5237,"lng":76.9269}]'),
 ('thiruvananthapuram','vazhuthacaud','Vazhuthacaud',8.4999,76.9566,4.4,4.4,4.5,4.4,0,9000,'Vazhuthacaud is a quiet, mostly residential pocket in the heart of the city with easy access to the Secretariat and MG Road.','[]'),
 ('kozhikode','chevayur','Chevayur',11.2853,75.8040,4.4,4.2,4.5,4.3,1,6800,'Chevayur is a popular family locality near the Medical College, with good schools and a mix of apartments and independent homes.','[{"name":"Government Medical College, Kozhikode","kind":"hospital","lat":11.2733,"lng":75.8316}]'),
 ('kozhikode','nadakkavu','Nadakkavu',11.2704,75.7770,4.3,4.4,4.3,4.2,0,6200,'Nadakkavu is a central residential and commercial area, within a short drive of the beach and the railway station.','[]'),
 ('kozhikode','mavoor-road','Mavoor Road',11.2570,75.7880,4.0,4.3,4.0,4.0,0,5600,'Mavoor Road is Kozhikode''s busy commercial spine with retail, offices and rental apartments.','[]'),
 ('kozhikode','palazhi','Palazhi',11.2990,75.8080,3.9,3.8,4.1,3.7,0,5000,'Palazhi is a growing residential area on the outskirts, with larger plots at lower prices than the city centre.','[]'),
 ('thrissur','poonkunnam','Poonkunnam',10.5400,76.2100,4.3,4.2,4.4,4.1,1,6200,'Poonkunnam is a calm residential area just outside the Swaraj Round, popular with families for independent houses.','[]'),
 ('thrissur','ayyanthole','Ayyanthole',10.5258,76.2182,4.2,4.1,4.3,4.0,0,5800,'Ayyanthole is a well-established locality close to the city centre with schools, banks and daily-needs shops.','[]'),
 ('thrissur','kuriachira','Kuriachira',10.5122,76.2203,4.1,4.2,4.2,3.9,0,6500,'Kuriachira has good road links, schools and hospitals and a mix of apartments and houses.','[]'),
 ('thrissur','ollur','Ollur',10.4870,76.2331,3.9,3.9,4.1,3.6,0,4800,'Ollur is a railway town south of the city with affordable plots and independent homes.','[]'),
 ('kollam','chinnakada','Chinnakada',8.8861,76.5948,4.2,4.4,4.1,4.0,1,5600,'Chinnakada is the commercial heart of Kollam, known for its clock tower, shops and offices.','[]'),
 ('kollam','asramam','Asramam',8.8950,76.5970,4.2,4.1,4.3,4.0,0,5200,'Asramam is a green residential area beside the Ashtamudi Lake front, close to the city centre.','[]'),
 ('kollam','kadappakada','Kadappakada',8.8780,76.6050,3.9,4.0,4.0,3.7,0,4400,'Kadappakada is a mixed residential area with good bus connectivity and affordable apartments.','[]'),
 ('kollam','thevally','Thevally',8.9040,76.5820,4.1,3.9,4.3,3.9,0,5000,'Thevally is a quiet residential locality with larger plots and independent houses.','[]');

INSERT INTO localities (city_id, slug, name, lat, lng, rating, connectivity, safety, lifestyle, description, landmarks, trending)
SELECT c.id, t.slug, t.name, t.lat, t.lng, t.rating, t.conn, t.safety, t.life, t.descr, t.landmarks, t.trending
FROM _loc t JOIN cities c ON c.slug = t.city;

-- 36 months of illustrative price and rent history ending at the current figure (about 7% a year growth)
INSERT INTO price_trends (locality_id, month, avg_price_sqft, avg_rent_2bhk)
SELECT lo.id,
       to_char(date_trunc('month', now()) - (g || ' months')::interval, 'YYYY-MM'),
       round(t.psf / power(1.0057, g) * (1 + (((lo.id * 31 + g * 17) % 21) - 10) / 1000.0))::int,
       (round(t.psf / power(1.0057, g) * 3.4 / 500.0) * 500)::int
FROM _loc t
JOIN cities c ON c.slug = t.city
JOIN localities lo ON lo.city_id = c.id AND lo.slug = t.slug
CROSS JOIN generate_series(0, 35) AS g;

-- 4. Demo profiles now point at Kerala
UPDATE profiles SET city_id = (SELECT id FROM cities WHERE slug = 'kochi'),
  about = 'Resale and rental specialist across Ernakulam since 2014. We handle documentation, home loans and registration end to end.'
 WHERE user_id = (SELECT id FROM users WHERE phone = '9876543211');
UPDATE profiles SET city_id = (SELECT id FROM cities WHERE slug = 'kochi')
 WHERE user_id = (SELECT id FROM users WHERE phone = '9876543212');

-- 5. One original sample listing per category
INSERT INTO listings (user_id, posted_by_type, title, transaction_type, category, property_type, city_id, locality_id,
  address, lat, lng, price, price_negotiable, maintenance, deposit, bhk, bathrooms, balconies,
  carpet_area, builtup_area, super_area, plot_area, floor, total_floors, facing, age_years, furnishing, construction_status,
  verified, featured, tenant_types, available_from, pg_sharing, pg_meals, description, status, published_at, expires_at)
SELECT u.id, v.posted_by, v.title, v.tx, v.cat, v.ptype, c.id, lo.id,
  v.address, v.lat::float8, v.lng::float8, v.price::bigint, v.nego::int, v.maint::bigint, v.deposit::int, v.bhk::int, v.bath::int, v.balc::int,
  v.carpet::int, v.builtup::int, v.super_a::int, v.plot::int, v.fl::int, v.tfl::int, v.facing, v.age::int, v.furn, v.cs,
  v.verified::int, v.featured::int, v.tenants, v.avail, v.sharing, v.meals::int, v.descr, 'live',
  to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char((now() + interval '60 days') AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM (VALUES
 ('9876543211','agent','3 BHK Apartment for Sale in Kakkanad, Kochi','sell','residential','apartment','kochi','kakkanad',
  'Near Infopark Road, Kakkanad, Kochi', 10.0152, 76.3428, 10200000, 1, 3500, NULL, 3, 3, 2,
  1180, NULL, 1420, NULL, 8, 14, 'East', 3, 'semi', 'ready',
  1, 1, NULL, NULL, NULL, NULL,
  E'Bright 3 BHK on the 8th floor of a 14-storey building, three years old and ready to move in. East-facing with cross ventilation in all three bedrooms and a balcony off the living room.\n\nModular kitchen with a utility area, wardrobes in two bedrooms and covered parking for one car. Lift, 24x7 security, power backup for common areas and a children''s play area.\n\nFifteen minutes to Infopark and the Kakkanad commercial strip; schools and a hospital within 3 km. Clear title; suitable for a home loan.'),
 ('9876543211','agent','4 BHK Villa for Sale in Kowdiar, Thiruvananthapuram','sell','residential','villa','thiruvananthapuram','kowdiar',
  'Kowdiar, Thiruvananthapuram', 8.5191, 76.9552, 32000000, 1, NULL, NULL, 4, 4, 3,
  2650, 3200, NULL, 2614, 2, 2, 'North-East', 6, 'unfurnished', 'ready',
  1, 1, NULL, NULL, NULL, NULL,
  E'Independent 4 BHK villa on a 6-cent plot in Kowdiar, built six years ago with a traditional sloping-roof design and modern finishes. About 3,200 sq ft built-up across two floors.\n\nFour bedrooms with attached baths, a double-height living room, a separate prayer room, a large kitchen with a work area and a car porch for two cars. Open sit-out, landscaped garden and a rainwater harvesting pit.\n\nQuiet, tree-lined road close to schools, hospitals and the city centre. Title documents are clear and the property is suitable for a home loan.'),
 ('9876543210','owner','3 BHK Independent House for Sale in Poonkunnam, Thrissur','sell','residential','house','thrissur','poonkunnam',
  'Poonkunnam, Thrissur', 10.5396, 76.2108, 8500000, 1, NULL, NULL, 3, 3, 2,
  1650, 1850, NULL, 1742, 1, 1, 'South', 6, 'semi', 'ready',
  1, 0, NULL, NULL, NULL, NULL,
  E'Well-kept single-storey house on a 4-cent plot, six years old. Three bedrooms (two with attached baths), a living and dining hall, kitchen with a store room, and a sit-out with a car porch.\n\nTiled flooring throughout, a bore well plus municipal water connection and a rooftop water tank. Compound wall with gate and space for a small kitchen garden.\n\nA short drive from Swaraj Round with schools and a hospital nearby. Owner is selling directly; no brokerage.'),
 ('9876543210','owner','5 Cent Residential Plot for Sale in Chevayur, Kozhikode','sell','residential','plot','kozhikode','chevayur',
  'Chevayur, Kozhikode', 11.2849, 75.8036, 6800000, 1, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, 2178, NULL, NULL, 'East', NULL, NULL, NULL,
  0, 0, NULL, NULL, NULL, NULL,
  E'Level, rectangular 5-cent plot (about 2,178 sq ft) with 22 ft road frontage on a tarred road, in a settled residential neighbourhood.\n\nElectricity and municipal water connections are at the gate. Clear title, building tax receipts up to date and a house plan can be approved for up to two floors. Ideal for an independent home.'),
 ('9876543210','owner','2 BHK Apartment for Rent in Edappally, Kochi','rent','residential','apartment','kochi','edappally',
  'Edappally, Kochi', 10.0268, 76.3131, 28000, 0, 2200, 3, 2, 2, 1,
  980, NULL, 1180, NULL, 5, 10, 'West', 4, 'semi', NULL,
  1, 1, 'family,bachelor', to_char(current_date + 7, 'YYYY-MM-DD'), NULL, NULL,
  E'Semi-furnished 2 BHK on the 5th floor, a ten-minute walk from Edappally Metro Station and close to the shopping and hospital cluster.\n\nWardrobes and modular kitchen provided, plus fans, lights and geysers. Lift, covered parking, 24x7 security and power backup for common areas.\n\nThree months'' deposit. Families and working professionals preferred. Available from next week.'),
 ('9876543210','owner','Working Women''s PG with Meals in Kazhakkoottam, Thiruvananthapuram','pg','residential','pg','thiruvananthapuram','kazhakkoottam',
  'Near Technopark, Kazhakkoottam', 8.5702, 76.8745, 7500, 0, NULL, 1, NULL, NULL, NULL,
  150, NULL, NULL, NULL, 1, 2, NULL, 5, 'furnished', NULL,
  1, 0, 'girls', to_char(current_date, 'YYYY-MM-DD'), 'double,triple', 1,
  E'Clean, well-run PG for working women, a short walk from the Technopark gate. Double and triple sharing rooms with cots, mattresses, cupboards and study tables.\n\nThree home-style vegetarian and non-vegetarian meals a day, Wi-Fi, a washing machine, hot water and daily housekeeping. A resident warden, CCTV at the entrance and a 10:30 pm gate time.\n\nOne month''s deposit and no brokerage.'),
 ('9876543211','agent','1,200 sq ft Office Space for Rent in Kakkanad, Kochi','rent','commercial','office','kochi','kakkanad',
  'Seaport-Airport Road, Kakkanad, Kochi', 10.0121, 76.3505, 66000, 1, 6000, 6, NULL, 2, NULL,
  1200, NULL, 1450, NULL, 3, 7, 'North', 5, 'furnished', NULL,
  1, 0, 'company', to_char(current_date + 14, 'YYYY-MM-DD'), NULL, NULL,
  E'Ready-to-use office floor on the 3rd level of a 7-storey commercial building on the Seaport-Airport Road. About 1,200 sq ft carpet area with a reception, an open workspace for 20 seats, two cabins, a meeting room and a pantry.\n\nCentral air conditioning, false ceiling, structured cabling, power backup and 8 parking slots. Two lifts and 24x7 security.\n\nSuitable for IT, services and back offices. Six months'' deposit; lock-in of 11 months.'),
 ('9876543211','agent','450 sq ft Ground-Floor Shop for Sale in Chinnakada, Kollam','sell','commercial','shop','kollam','chinnakada',
  'Chinnakada, Kollam', 8.8866, 76.5953, 7200000, 1, NULL, NULL, NULL, 1, NULL,
  450, NULL, 520, NULL, 0, 3, 'West', 12, 'unfurnished', 'ready',
  0, 0, NULL, NULL, NULL, NULL,
  E'Ground-floor shop room of about 450 sq ft in the Chinnakada main market, with about 14 ft of frontage on a busy road and consistent walk-in footfall.\n\nRolling shutter, three-phase electricity, a toilet at the rear and space for signage. The building is twelve years old and the title is clear.\n\nSuitable for a showroom, pharmacy, clinic, bank branch or retail outlet.'),
 ('9876543211','agent','8,000 sq ft Warehouse for Rent in Kalamassery, Kochi','rent','commercial','warehouse','kochi','kalamassery',
  'Kalamassery industrial area, Kochi', 10.0560, 76.3200, 224000, 1, NULL, 6, NULL, 2, NULL,
  8000, NULL, NULL, NULL, 0, 1, 'South', 8, 'unfurnished', NULL,
  0, 0, 'company', to_char(current_date + 10, 'YYYY-MM-DD'), NULL, NULL,
  E'Single-storey 8,000 sq ft warehouse in the Kalamassery industrial belt, about 20 minutes from the NH 66 bypass and close to the container terminal route.\n\n22 ft clear height under the roof, three loading doors with a level dock for trucks, three-phase power, a separate office room, toilets and a security cabin. Concrete flooring suitable for racking.\n\nSuitable for logistics, e-commerce, storage and light assembly. Six months'' deposit.')
) AS v(phone, posted_by, title, tx, cat, ptype, city_slug, loc_slug, address, lat, lng, price, nego, maint, deposit, bhk, bath, balc,
  carpet, builtup, super_a, plot, fl, tfl, facing, age, furn, cs, verified, featured, tenants, avail, sharing, meals, descr)
JOIN users u ON u.phone = v.phone
JOIN cities c ON c.slug = v.city_slug
JOIN localities lo ON lo.city_id = c.id AND lo.slug = v.loc_slug;

-- 6. Photos: matching illustrations per category (served by /api/art), plus a floor plan where it applies
INSERT INTO listing_media (listing_id, kind, url, sort)
SELECT l.id, 'photo', '/api/art/' || m.art || '/' || (l.id * 11 + m.n), m.n
FROM listings l
JOIN (VALUES
  ('apartment','tower',0),('apartment','living',1),('apartment','bed',2),('apartment','kitchen',3),
  ('villa','villa',0),('villa','living',1),('villa','bed',2),('villa','kitchen',3),
  ('house','house',0),('house','living',1),('house','bed',2),('house','kitchen',3),
  ('plot','plot',0),('plot','plot',1),
  ('pg','bed',0),('pg','bed',1),('pg','living',2),('pg','kitchen',3),
  ('office','office',0),('office','office',1),('office','kitchen',2),
  ('shop','shop',0),('shop','shop',1),
  ('warehouse','warehouse',0),('warehouse','warehouse',1)
) AS m(ptype, art, n) ON m.ptype = l.property_type;

INSERT INTO listing_media (listing_id, kind, url, sort)
SELECT id, 'floorplan', '/api/art/floorplan/' || id, 0 FROM listings WHERE property_type IN ('apartment','villa','house');

-- 7. Amenities
INSERT INTO listing_amenities (listing_id, amenity)
SELECT l.id, a.amenity FROM listings l JOIN (VALUES
  ('apartment','parking'),('apartment','lift'),('apartment','security'),('apartment','power_backup'),('apartment','play_area'),('apartment','cctv'),
  ('villa','parking'),('villa','rainwater'),('villa','park'),('villa','security'),
  ('house','parking'),('house','rainwater'),
  ('plot','security'),
  ('pg','wifi'),('pg','meals'),('pg','housekeeping'),('pg','cctv'),('pg','power_backup'),('pg','security'),
  ('office','parking'),('office','lift'),('office','ac'),('office','power_backup'),('office','security'),('office','wifi'),
  ('shop','security'),
  ('warehouse','parking'),('warehouse','power_backup'),('warehouse','security'),('warehouse','cctv')
) AS a(ptype, amenity) ON a.ptype = l.property_type;

-- 8. Audit trail rows so moderation history looks right
INSERT INTO moderation_logs (listing_id, actor_id, action, reason)
SELECT id, NULL, 'submitted', NULL FROM listings;
INSERT INTO moderation_logs (listing_id, actor_id, action, reason)
SELECT l.id, (SELECT id FROM users WHERE phone = '9000000002'), 'approved', NULL FROM listings l;

COMMIT;
