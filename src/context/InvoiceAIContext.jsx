import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const STEPS = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  REVIEW: 'review',
  DONE: 'done',
};

const STORAGE_KEY = 'dicrejart_invoice_ai_state';

const InvoiceAIContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useInvoiceAI = () => {
  const context = useContext(InvoiceAIContext);
  if (!context) {
    throw new Error('useInvoiceAI must be used within InvoiceAIProvider');
  }
  return context;
};

export const InvoiceAIProvider = ({ children }) => {
  // Estado principal
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [facturaStorageUrl, setFacturaStorageUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [result, setResult] = useState(null);

  // Cargar estado desde localStorage al montar
  useEffect(() => {
    let timeoutId;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.extractedData && parsed.step !== STEPS.UPLOAD) {
          timeoutId = setTimeout(() => {
            setStep(parsed.step);
            setExtractedData(parsed.extractedData);
            setFacturaStorageUrl(parsed.facturaStorageUrl);
            setResult(parsed.result);
          }, 0);
        }
      }
    } catch (e) {
      console.error('Error loading invoice AI state:', e);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Guardar estado en localStorage cuando cambia
  useEffect(() => {
    try {
      const toSave = {
        step,
        extractedData,
        facturaStorageUrl,
        result,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Error saving invoice AI state:', e);
    }
  }, [step, extractedData, facturaStorageUrl, result]);

  // Limpiar estado
  const reset = useCallback(() => {
    setStep(STEPS.UPLOAD);
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFacturaStorageUrl(null);
    setExtractedData(null);
    setResult(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [previewUrl]);

  // Establecer archivo seleccionado
  const setFileSelected = useCallback((selectedFile) => {
    setFile(selectedFile);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (selectedFile?.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  }, [previewUrl]);

  // Establecer datos extra├¡dos
  const setProcessedData = useCallback((data, storageUrl) => {
    setExtractedData(data);
    setFacturaStorageUrl(storageUrl);
    setStep(STEPS.REVIEW);
  }, []);

  // Establecer resultado final
  const setFinalResult = useCallback((confirmedData) => {
    setResult(confirmedData);
    setStep(STEPS.DONE);
  }, []);

  // Volver a paso de upload
  const backToUpload = useCallback(() => {
    setStep(STEPS.UPLOAD);
  }, []);

  // Volver a procesamiento
  const setProcessing = useCallback(() => {
    setStep(STEPS.PROCESSING);
  }, []);

  const value = useMemo(() => ({
    // Estado
    step,
    file,
    previewUrl,
    facturaStorageUrl,
    extractedData,
    result,
    STEPS,
    
    // Acciones
    reset,
    setFileSelected,
    setProcessedData,
    setFinalResult,
    backToUpload,
    setProcessing,
  }), [
    step, file, previewUrl, facturaStorageUrl, extractedData, result,
    reset, setFileSelected, setProcessedData, setFinalResult, backToUpload, setProcessing
  ]);

  return (
    <InvoiceAIContext.Provider value={value}>
      {children}
    </InvoiceAIContext.Provider>
  );
};
