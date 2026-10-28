# Shipping Carrier Requirements and Rate Table

## 1. Carrier commercial/rate data

Ask them for a rate card in CSV or Excel with these columns:

| Field | Example |
|---|---|
| Carrier | Aramex / SMSA / Naqel / Saudi Post |
| Service | Express / Same-day / Economy / Pickup |
| Region | Riyadh |
| City | Riyadh |
| District / remote area | Al Olaya / remote |
| Base rate | 20.00 SAR |
| Included weight | 1 kg |
| Extra per kg | 5.00 SAR |
| Weight rounding | round up to 0.5 / 1 kg |
| Free-shipping threshold | 200 SAR or none |
| COD fee | 10 SAR or 2.5% |
| COD fee minimum | 5 SAR |
| Remote-area surcharge | 15 SAR |
| Fuel surcharge | 0% / 5% |
| ETA minimum days | 1 |
| ETA maximum days | 3 |
| Pickup available | yes/no |
| COD available | yes/no |
| VAT included in carrier rate | yes/no |
| Effective date | 2026-11-01 |

Also ask for:

- full coverage list by **region and city**
- remote-area / out-of-delivery-zone list
- maximum weight and dimensions
- whether rates are by actual or volumetric weight
- failed-delivery and return-to-sender fees
- storage fees
- insurance rules
- cutoff time and pickup schedule
- COD remittance schedule
- cancellation rules
- label format and printer requirements

## 2. API information

If they provide an API:

- sandbox and production base URLs
- authentication method and test credentials
- rate-quote endpoint with sample request/response
- shipment-create endpoint with sample
- cancel-shipment endpoint
- tracking endpoint/webhook and signature method
- label endpoint and format (PDF/ZPL/PNG)
- error codes and rate limits
- IP allow-list requirements
- whether rates are quoted live or only via a static contract rate card

If they do not have an API yet, the admin rate table is enough to start.

## 3. Proposed admin shipping table

I'll add two admin-managed collections:

### `ShippingZone`

```text
id
name
country
regions[]        e.g. Riyadh, Makkah, Eastern Province
cities[]         optional; empty = whole region
districts[]      optional remote areas
isActive
priority
```

### `ShippingRate`

```text
id
zoneId
carrier
serviceName
baseRate
includedWeightKg
extraPerKg
weightRoundingKg
freeShippingEnabled
freeShippingMinPrice
codFee
codFeePercent
codFeeMin
remoteSurcharge
fuelSurchargePercent
etaMinDays
etaMaxDays
pickupAvailable
codAvailable
vatIncluded
isActive
effectiveFrom
```

### Resolution flow

```text
customer address
  → match region/city/district
  → active zone
  → eligible carrier services
  → weight + order value
  → final shipping rate
  → save snapshot on the order
```

The order will store:

```text
shippingZoneName
carrier
serviceName
shippingRate
etaMinDays
etaMaxDays
codFee
```

so historical orders never change when rates change.

## 4. Checkout changes

- Resolve rates from the customer's region/city after address entry.
- Show carrier/service, price and ETA.
- Show pickup if the zone supports it.
- Show COD fee when COD is selected.
- Apply free shipping threshold.
- Fall back to a configurable "unserved area" message or manual quote.
- Save the selected rate snapshot on the order.

## 5. What I need for starting default values

For **one carrier**, send me:

1. Carrier name
2. Rate card / coverage list
3. Default base rate
4. Extra per kg
5. Included weight
6. COD fee
7. Remote-area surcharge
8. Free-shipping threshold
9. ETA range
10. Pickup availability
11. API docs if available

A simple starting CSV like this is enough:

```csv
carrier,service,region,city,base_rate,extra_per_kg,included_kg,free_shipping_threshold,cod_fee,remote_surcharge,eta_min_days,eta_max_days,pickup,cod,active
Aramex,Express,Riyadh,Riyadh,20,5,1,200,10,0,1,2,yes,yes,true
Aramex,Express,Makkah,Jeddah,25,6,1,200,10,0,2,3,yes,yes,true
```

## 6. One prerequisite I'll add

The variant model already stores `weight`, but order items do not currently snapshot it. I'll add `weight` to order items so shipping is calculated from the purchased variant and remains stable historically.

## Decisions needed from you

1. Which carrier should be the default starting option?
2. Do you want **flat per-city rates** first, or **weight-based rates** from day one?
3. Is shipping charged to the customer with VAT included, excluded, or treated as non-taxable as now?
4. Should pickup be offered at the store address?

---

## Confirmed decisions

- Default carrier: **SMSA**
- Pricing model: **flat per-city rates**
- Shipping tax treatment: **non-taxable**, as currently implemented
- Pickup: **yes**, offered at the store/seller address
- Default values until SMSA provides its commercial rate card:
  - Riyadh: **Tomorrow**, **20 SAR**, ETA **1 day**, free when the basket reaches the store-wide free-shipping limit
  - Outside Riyadh: **Tomorrow** (paid), **Next 3 Days** (paid), **Next 5 Days** (free when the basket reaches the store-wide free-shipping limit)
  - Included weight: **1 kg**
  - Extra per kg: **5 SAR**
  - Free-shipping limit: **Settings → Common → Free Shipping Minimum Price** (per-service override available)
  - COD fee: **10 SAR**
  - Remote-area surcharge: **0 SAR**
  - Pickup: **0 SAR**

## Implementation note

The admin table is implemented as one `ShippingRate` collection with zone fields (`zoneName`, `country`, `region`, `city`) rather than separate zone and rate documents. This keeps flat per-city rates editable in one screen while still supporting a default `*` region/city fallback.

Free shipping is configured **per service and per area**:

- `freeShippingEnabled` turns free shipping on or off for that service. Disabled services stay paid even when the basket is above the limit.
- `freeShippingMinPrice` is an optional per-service basket threshold. Leave it at `0` to use the store-wide limit from **Settings → Common → Free Shipping Minimum Price**. Enter a positive amount to override the limit for this service only.
- `country`, `region` and `city` decide which area the rule applies to.
- Create one row per delivery speed. For example:
  - Riyadh / Riyadh / Tomorrow / freeShippingEnabled = true / threshold 0 (uses the store-wide limit).
  - Jeddah / Makkah / Tomorrow / freeShippingEnabled = false.
  - Jeddah / Makkah / Next 3 Days / freeShippingEnabled = false.
  - Jeddah / Makkah / Next 5 Days / freeShippingEnabled = true / threshold 0 (uses the store-wide limit).

- Admin: `/admin/shipping`
- Seed defaults: `npm run migrate:shipping` (add `--force` to replace existing rows)
- Checkout: country → active region/city rate → cart weight/free-shipping threshold → selected quote snapshot on the order
- Order snapshot: `shippingRateId`, `shippingZone`, `shippingCarrier`, `shippingService`, `shippingEtaMin/Max`, `isPickup`, `pickupLocation`, `codFee`

