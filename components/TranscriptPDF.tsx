import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { TranscriptionResponse } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: 'bold',
    color: '#1e1b4b',
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 15,
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#312e81',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
    paddingBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#334155',
    marginBottom: 20,
  },
  segment: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  speaker: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginRight: 10,
  },
  metaText: {
    fontSize: 10,
    color: '#64748b',
    marginRight: 10,
  },
  content: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#0f172a',
  },
  translationBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  translationText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
    lineHeight: 1.4,
  },
});

interface TranscriptPDFProps {
  data: TranscriptionResponse;
}

const TranscriptPDF: React.FC<TranscriptPDFProps> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>EchoScript AI - Transcription</Text>
      
      <Text style={styles.sectionTitle}>Summary</Text>
      <Text style={styles.summaryText}>{data.summary}</Text>
      
      <Text style={styles.sectionTitle}>Detailed Transcript</Text>
      {data.segments.map((segment, index) => (
        <View key={index} style={styles.segment} wrap={false}>
          <View style={styles.metaRow}>
            <Text style={styles.speaker}>{segment.speaker}</Text>
            <Text style={styles.metaText}>{segment.timestamp}</Text>
            <Text style={styles.metaText}>{segment.language}</Text>
            {segment.emotion && <Text style={styles.metaText}>{segment.emotion}</Text>}
          </View>
          <Text style={styles.content}>{segment.content}</Text>
          
          {segment.translation && (
            <View style={styles.translationBox}>
              <Text style={styles.translationLabel}>ENGLISH TRANSLATION</Text>
              <Text style={styles.translationText}>{segment.translation}</Text>
            </View>
          )}
        </View>
      ))}
    </Page>
  </Document>
);

export default TranscriptPDF;
