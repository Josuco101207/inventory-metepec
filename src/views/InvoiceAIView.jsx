import React, { useState, useCallback } from 'react';
import { Sparkles, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import InvoiceUploader from '../components/InvoiceUploader';
import InvoiceReviewForm from '../components/InvoiceReviewForm';
import { processInvoice } from '../services/invoiceAI';
import { toast } from 'sonner';
import './InvoiceAIView.css';

const STEPS = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  REVIEW: 'review',
  DONE: 'done',
};

const InvoiceAIView = () => {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileSelected = useCallback(async (selectedFile) => {
    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) {
      toast.error('Selecciona un archivo primero');
      return;
    }
    setStep(STEPS.PROCESSING);
    try {
      const data = await processInvoice(file);
      setExtractedData(data);
      setStep(STEPS.REVIEW);
      toast.success('Factura procesada exitosamente');
    } catch (err) {
      console.error('Invoice processing error:', err);
      const msg = err.message || '';
      let friendly = 'Ocurrió un error al procesar la factura. Intenta de nuevo.';
      if (msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('spike') || msg.toLowerCase().includes('503') || msg.toLowerCase().includes('429')) {
        friendly = 'La IA está muy ocupada en este momento. Espera unos segundos y vuelve a intentarlo.';
      } else if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit')) {
        friendly = 'Se alcanzó el límite de uso de la IA. Intenta más tarde.';
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed to fetch')) {
        friendly = 'Sin conexión a internet. Verifica tu red y vuelve a intentarlo.';
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('400')) {
        friendly = 'El archivo no pudo ser leído por la IA. Intenta con una imagen más clara.';
      }
      toast.error(friendly, { duration: 6000 });
      setStep(STEPS.UPLOAD);
    }
  }, [file]);

  const handleConfirm = useCallback((confirmedData) => {
    setResult(confirmedData);
    setStep(STEPS.DONE);
  }, []);

  const handleReset = useCallback(() => {
    setStep(STEPS.UPLOAD);
    setFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setResult(null);
  }, []);

  return (
    <div className="iaiv-container">
      {/* Header */}
      {step !== STEPS.REVIEW && (
        <div className="iaiv-header">
          <div className="iaiv-header-left">
            <div className="iaiv-header-icon">
              <Sparkles size={26} />
            </div>
            <div>
              <h1 className="iaiv-title">Carga Inteligente</h1>
              <p className="iaiv-subtitle">Sube una factura y la IA extraerá los productos automáticamente</p>
            </div>
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {(step === STEPS.UPLOAD || step === STEPS.PROCESSING) && (
        <div className="iaiv-upload-section">
          <InvoiceUploader
            onFileSelected={handleFileSelected}
            processing={step === STEPS.PROCESSING}
            disabled={step === STEPS.PROCESSING}
          />
          {step === STEPS.UPLOAD && file && (
            <div className="iaiv-file-ready">
              <FileText size={18} />
              <span>{file.name}</span>
              <button className="fly-btn fly-btn-primary" onClick={handleProcess}>
                <Sparkles size={18} />
                Procesar con IA
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: Review */}
      {step === STEPS.REVIEW && extractedData && (
        <InvoiceReviewForm
          extractedData={extractedData}
          previewUrl={previewUrl}
          onBack={() => setStep(STEPS.UPLOAD)}
          onConfirm={handleConfirm}
        />
      )}

      {/* Step: Done */}
      {step === STEPS.DONE && result && (
        <div className="iaiv-done">
          <div className="iaiv-done-card">
            <div className="iaiv-done-icon">
              <CheckCircle2 size={48} />
            </div>
            <h2>Factura Procesada</h2>
            <p>Se registraron <strong>{result.items.length}</strong> productos del proveedor <strong>{result.header.proveedor}</strong></p>
            <div className="iaiv-done-summary">
              <div className="iaiv-done-stat">
                <span className="iaiv-done-label">Folio</span>
                <span className="iaiv-done-value">{result.header.folio}</span>
              </div>
              <div className="iaiv-done-stat">
                <span className="iaiv-done-label">Total</span>
                <span className="iaiv-done-value">
                  {(result.totals.total).toLocaleString('es-MX', { style: 'currency', currency: result.header.moneda || 'MXN' })}
                </span>
              </div>
              <div className="iaiv-done-stat">
                <span className="iaiv-done-label">Items nuevos</span>
                <span className="iaiv-done-value">{result.items.filter(i => i.isNew).length}</span>
              </div>
              <div className="iaiv-done-stat">
                <span className="iaiv-done-label">Items actualizados</span>
                <span className="iaiv-done-value">{result.items.filter(i => !i.isNew).length}</span>
              </div>
            </div>
            <button className="fly-btn fly-btn-primary" onClick={handleReset} style={{ marginTop: '1.5rem' }}>
              <Sparkles size={18} />
              Procesar Otra Factura
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceAIView;
