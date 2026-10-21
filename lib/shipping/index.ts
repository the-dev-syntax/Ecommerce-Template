import type { ShipmentInput, ShippingProvider } from './types'

export const manualShippingProvider: ShippingProvider = {
  id: 'manual',
  name: 'Manual / self-managed',
  createShipment: async (input: ShipmentInput) => ({
    provider: 'manual',
    trackingNumber: input.trackingNumber,
    trackingUrl: input.trackingUrl,
    status: 'in_transit',
  }),
}

export const shippingProviders: ShippingProvider[] = [manualShippingProvider]

export function getShippingProvider(id: string) {
  return shippingProviders.find((provider) => provider.id === id)
}
