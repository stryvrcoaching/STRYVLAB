'use server'

import {
  Document,
  Page,
  Text,
  View,
  Image as PDFImage,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    padding: 48,
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  coachName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  coachEmail: {
    fontSize: 9,
    color: '#888',
    marginTop: 3,
  },
  receiptTitle: {
    textAlign: 'right',
  },
  receiptLabel: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  invoiceNumber: {
    fontSize: 9,
    color: '#888',
    marginTop: 4,
  },
  invoiceDate: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginVertical: 20,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  clientEmail: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 10,
    color: '#888',
  },
  detailValue: {
    fontSize: 10,
    color: '#1a1a1a',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1f8a65',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 8,
    color: '#ccc',
    fontStyle: 'italic',
  },
  poweredBy: {
    fontSize: 8,
    color: '#ccc',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptData {
  invoiceNumber: string
  date: string              // YYYY-MM-DD
  coachName: string
  coachEmail: string
  coachLogoUrl?: string | null
  clientName: string
  clientEmail: string
  formulaName: string
  period: string            // ex: "Avril 2026"
  amount: number
  paymentMethod: string
}

const METHOD_LABELS: Record<string, string> = {
  manual: 'Manuel',
  bank_transfer: 'Virement bancaire',
  card: 'Carte bancaire',
  cash: 'Espèces',
  stripe: 'Stripe',
  other: 'Autre',
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

function ReceiptDocument({ data }: { data: ReceiptData }) {
  const dateFormatted = new Date(data.date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {data.coachLogoUrl && (
              <PDFImage
                src={data.coachLogoUrl}
                style={{ width: 40, height: 40, objectFit: 'contain' }}
              />
            )}
            <View>
              <Text style={styles.coachName}>{data.coachName}</Text>
              <Text style={styles.coachEmail}>{data.coachEmail}</Text>
            </View>
          </View>
          <View style={styles.receiptTitle}>
            <Text style={styles.receiptLabel}>REÇU DE PAIEMENT</Text>
            <Text style={styles.invoiceNumber}>N° {data.invoiceNumber}</Text>
            <Text style={styles.invoiceDate}>{dateFormatted}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Client ── */}
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.sectionLabel}>Client</Text>
          <Text style={styles.clientName}>{data.clientName}</Text>
          <Text style={styles.clientEmail}>{data.clientEmail}</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Détail ── */}
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.sectionLabel}>Détail</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Formule</Text>
          <Text style={styles.detailValue}>{data.formulaName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Période</Text>
          <Text style={styles.detailValue}>{data.period}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Méthode de paiement</Text>
          <Text style={styles.detailValue}>{METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod}</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Total ── */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>{data.amount.toFixed(2)} €</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            * Reçu non contractuel — facture légale disponible sur demande
          </Text>
          <Text style={styles.poweredBy}>Généré avec STRYVR</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Generator ────────────────────────────────────────────────────────────────

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const buffer = await renderToBuffer(<ReceiptDocument data={data} />)
  return Buffer.from(buffer)
}
