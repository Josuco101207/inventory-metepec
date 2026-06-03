import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Solo restauramos si hay datos procesados para evitar reprocesar
        if (parsed.extractedData && parsed.step !== STEPS.UPLOAD) {
          setTimeout(() => {
            setStep(parsed.step);
            setExtractedData(parsed.extractedData);
            setFacturaStorageUrl(parsed.facturaStorageUrl);
            setResult(parsed.result);
          }, 0);
          // No restauramos file y previewUrl para evitar problemas con Blobs
          // El usuario puede volver a cargar la imagen si es necesario
        }
      }
    } catch (e) {
      console.error('Error loading invoice AI state:', e);
    }
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
    setPreviewUrl(null);
    setFacturaStorageUrl(null);
    setExtractedData(null);
    setResult(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Establecer archivo seleccionado
  const setFileSelected = useCallback((selectedFile) => {
    setFile(selectedFile);
    if (selectedFile?.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  }, []);

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

  const value = {
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
  };

  return (
    <InvoiceAIContext.Provider value={value}>
      {children}
    </InvoiceAIContext.Provider>
  );
};
