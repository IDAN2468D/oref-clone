/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import Home from '../app/page'

// Mock html2canvas
jest.mock('html2canvas', () => jest.fn())

// Setup a mock API fetcher
beforeEach(() => {
    global.fetch = jest.fn((url: any) => {
        const u = typeof url === 'string' ? url : (url.url || url.toString());
        if (u.includes('/api/alerts')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    active: { data: ['תל אביב', 'שדרות'] },
                    saved_alerts: [{ cities: ['תל אביב'], title: 'ירי טילים', timestamp: new Date().toISOString() }]
                })
            } as any)
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ insight: 'Mock Insight' }) } as any)
    })
})

describe('National Command Center Dashboard', () => {
    it('renders and displays active alerts from API', async () => {
        render(<Home />)

        // Find main title
        expect(screen.getByText(/מרכז שליטה ארצי/i)).toBeInTheDocument()

        // Wait for dynamic alert banner to appear via poller
        const banner = await screen.findByTestId('active-alert-banner', {}, { timeout: 12000 })
        expect(banner).toBeInTheDocument()

        // Use 'within' to specifically check for alert text INSIDE the red banner
        expect(within(banner).getByText(/תל אביב/i)).toBeInTheDocument()
        expect(within(banner).getByText(/שדרות/i)).toBeInTheDocument()

        // Final verification of status message
        expect(screen.getByText(/זיהוי שיגור מאומת/i)).toBeInTheDocument()
    }, 25000)
})
