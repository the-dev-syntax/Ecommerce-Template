export interface ShipmentInput {
  orderId: string
  trackingNumber: string
  trackingUrl?: string
}

export interface ShipmentResult {
  provider: string
  trackingNumber: string
  trackingUrl?: string
  status: 'created' | 'in_transit'
}

export interface ShippingProvider {
  id: string
  name: string
  createShipment: (input: ShipmentInput) => Promise<ShipmentResult>
  cancelShipment?: (trackingNumber: string) => Promise<void>
}
