package com.luis.aprendejuega;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Aprende y Juega: la app completa vive en assets/ (HTML + JavaScript) y se muestra en un WebView.
 * Esta clase solo agrega lo que el WebView no trae: guardar archivos, leer en voz alta (español e inglés),
 * reconocer la voz del niño para Teacher Owl y pedir el permiso del micrófono.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final int REQ_MIC = 7;
    private static final int REQ_MIC_VOZ = 8;
    private static final int REQ_ARCHIVO = 9;
    private ValueCallback<Uri[]> archivoCb;
    private Uri fotoUri;

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsListo = false;
    private PermissionRequest pendingMic;
    private SpeechRecognizer reconocedor;
    private String idiomaPendiente;
    // Voz: cada pedido nuevo cancela el anterior (turno). Teacher Owl habla español y dice las palabras en inglés.
    private volatile int turnoCola = 0;
    private final Handler mano = new Handler(Looper.getMainLooper());
    private long finEscucha = 0;              // cuándo soltó el micrófono (para no hablar encima)
    private ArrayList<String> parciales = new ArrayList<>();
    private boolean reintentoMic = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingMic = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                    }
                });
            }

            // <input type="file">: elegir una foto de la galería o tomarla con la cámara (traducir fotos, corrector)
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (archivoCb != null) archivoCb.onReceiveValue(null);
                archivoCb = cb;
                fotoUri = null;
                try {
                    Intent elegir = params.createIntent();
                    elegir.addCategory(Intent.CATEGORY_OPENABLE);
                    String[] tipos = params.getAcceptTypes();
                    boolean esImagen = tipos != null && tipos.length > 0 && tipos[0] != null && tipos[0].startsWith("image");
                    if (!esImagen) elegir.setType("*/*");
                    Intent menu = Intent.createChooser(elegir, "Elegir foto");
                    if (esImagen && Build.VERSION.SDK_INT >= 29) {
                        ContentValues v = new ContentValues();
                        v.put(MediaStore.Images.Media.DISPLAY_NAME, "foto_" + System.currentTimeMillis() + ".jpg");
                        v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                        v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AprendeYJuega");
                        fotoUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                        if (fotoUri != null) {
                            Intent camara = new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                                    .putExtra(MediaStore.EXTRA_OUTPUT, fotoUri)
                                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            menu.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camara});
                        }
                    }
                    startActivityForResult(menu, REQ_ARCHIVO);
                } catch (Exception e) {
                    archivoCb = null;
                    return false;
                }
                return true;
            }

            // Los enlaces con target="_blank" llegan aquí: abrirlos en el navegador del teléfono
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView.HitTestResult r = view.getHitTestResult();
                String url = r != null ? r.getExtra() : null;
                if (url != null) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {
                    }
                }
                return false;
            }
        });
        s.setSupportMultipleWindows(true);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                ttsListo = true;
                ponerIdioma("es-CO");
                tts.setSpeechRate(0.95f);
                // Por el canal de medios: así el micrófono no la deja bajita ni cortada
                tts.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onError(String id) { }
                    @Override public void onDone(String id) { }
                });
            }
        });

        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl("https://" + HOST + "/assets/index.html");
    }

    private void ponerIdioma(String tag) {
        if (tts == null || !ttsListo) return;
        Locale l = Locale.forLanguageTag(tag);
        int r = tts.setLanguage(l);
        if (r < 0) tts.setLanguage(new Locale(l.getLanguage()));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_ARCHIVO || archivoCb == null) return;
        Uri[] res = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) res = new Uri[]{data.getData()};
            else if (fotoUri != null) res = new Uri[]{fotoUri};
        }
        // Si tomó otra opción o canceló, se borra la foto vacía que se había preparado
        if (fotoUri != null && (res == null || res[0] != fotoUri)) {
            try { getContentResolver().delete(fotoUri, null, null); } catch (Exception ignored) { }
        }
        archivoCb.onReceiveValue(res);
        archivoCb = null;
        fotoUri = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQ_MIC && pendingMic != null) {
            if (ok) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingMic.deny();
            pendingMic = null;
        } else if (requestCode == REQ_MIC_VOZ) {
            if (ok && idiomaPendiente != null) escuchar(idiomaPendiente);
            else enviarError("Necesito permiso del micrófono para escucharte");
            idiomaPendiente = null;
        }
    }

    // ---------- Reconocimiento de voz para Teacher Owl ----------
    private void escuchar(String idioma) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            idiomaPendiente = idioma;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC_VOZ);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            enviarError("Tu teléfono no tiene reconocimiento de voz");
            return;
        }
        // Primero se calla Owl y se espera un momento: si no, el micrófono se oye a sí mismo o arranca cortado
        turnoCola++;
        boolean hablaba = tts != null && tts.isSpeaking();
        if (tts != null) tts.stop();
        reintentoMic = false;
        mano.postDelayed(() -> empezarEscucha(idioma), hablaba ? 400 : 80);
    }

    private void empezarEscucha(final String idioma) {
        soltarMic(false);
        parciales = new ArrayList<>();
        reconocedor = SpeechRecognizer.createSpeechRecognizer(this);
        reconocedor.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                // Ahora sí: el niño ya puede hablar
                web.evaluateJavascript("window.onVozListo && window.onVozListo()", null);
            }
            @Override public void onBeginningOfSpeech() { }
            @Override public void onRmsChanged(float rmsdB) { }
            @Override public void onBufferReceived(byte[] buffer) { }
            @Override public void onEndOfSpeech() { }
            @Override public void onEvent(int eventType, Bundle params) { }
            @Override
            public void onPartialResults(Bundle b) {
                ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (l != null && !l.isEmpty() && l.get(0) != null && !l.get(0).trim().isEmpty()) parciales = l;
            }
            @Override
            public void onError(int error) {
                soltarMic(true);
                // El micrófono anterior seguía ocupado: se intenta una vez más
                if ((error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) && !reintentoMic) {
                    reintentoMic = true;
                    mano.postDelayed(() -> empezarEscucha(idioma), 500);
                    return;
                }
                // Se cortó pero alcanzó a entender algo: se usa eso
                if ((error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) && !parciales.isEmpty()) {
                    enviarResultados(parciales);
                    return;
                }
                String msg;
                switch (error) {
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                        msg = "No te escuché. Habla cuando el botón diga «¡Habla ahora!»";
                        break;
                    case SpeechRecognizer.ERROR_NO_MATCH:
                        msg = "No te entendí bien";
                        break;
                    case SpeechRecognizer.ERROR_NETWORK:
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                        msg = "Se necesita internet para escucharte";
                        break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                        msg = "Falta el permiso del micrófono";
                        break;
                    case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                        msg = "El micrófono está ocupado. Intenta otra vez";
                        break;
                    default:
                        msg = "No te escuché bien";
                }
                enviarError(msg);
            }
            @Override
            public void onResults(Bundle results) {
                ArrayList<String> lista = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if ((lista == null || lista.isEmpty()) && !parciales.isEmpty()) lista = parciales;
                soltarMic(true);
                enviarResultados(lista);
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        // Los niños hacen pausas: se les da más tiempo antes de cortar
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1200L);
        try {
            reconocedor.startListening(i);
        } catch (Exception e) {
            soltarMic(true);
            enviarError("No se pudo usar el micrófono");
        }
    }

    /** Suelta el micrófono (se destruye después, fuera del aviso del reconocedor). */
    private void soltarMic(boolean marcarFin) {
        if (marcarFin) finEscucha = SystemClock.uptimeMillis();
        final SpeechRecognizer r = reconocedor;
        reconocedor = null;
        if (r != null) mano.post(() -> { try { r.cancel(); r.destroy(); } catch (Exception ignored) { } });
    }

    private void enviarResultados(ArrayList<String> lista) {
        JSONArray arr = new JSONArray();
        if (lista != null) for (String x : lista) arr.put(x);
        String js = "window.onVozResultado && window.onVozResultado(" + JSONObject.quote(arr.toString()) + ")";
        web.evaluateJavascript(js, null);
    }

    // ---------- Voz de Owl: todas las frases se encolan de una vez (sin cortes entre español e inglés) ----------
    private void hablarCola(final ArrayList<String[]> segs) {
        if (tts == null) return;
        final int turno = ++turnoCola;
        tts.stop();
        Runnable decir = () -> {
            if (turno != turnoCola || tts == null || !ttsListo) return;
            // Une trozos seguidos del mismo idioma y velocidad, y quita los que no tienen letras
            ArrayList<String[]> unidos = new ArrayList<>();
            for (String[] x : segs) {
                String t = x[0] == null ? "" : x[0].trim();
                if (!t.matches("(?s).*[\\p{L}\\d].*")) continue;
                String[] u = unidos.isEmpty() ? null : unidos.get(unidos.size() - 1);
                if (u != null && u[1].equals(x[1]) && u[2].equals(x[2])) u[0] = u[0] + " " + t;
                else unidos.add(new String[]{t, x[1], x[2]});
            }
            int n = 0;
            for (String[] x : unidos) {
                ponerIdioma(x[1]);
                float v = 1f;
                try { v = Float.parseFloat(x[2]); } catch (Exception ignored) { }
                tts.setSpeechRate(v);
                for (String parte : partir(x[0])) {
                    tts.speak(parte, n == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, "t" + turno + "_" + n);
                    n++;
                }
            }
        };
        // Si el micrófono acaba de soltarse, se espera un poco para que la voz no salga cortada
        long espera = 450 - (SystemClock.uptimeMillis() - finEscucha);
        if (espera > 0) mano.postDelayed(decir, espera);
        else decir.run();
    }

    /** TextToSpeech tiene un límite por frase: los textos largos se dividen por oraciones. */
    private static ArrayList<String> partir(String t) {
        ArrayList<String> out = new ArrayList<>();
        StringBuilder b = new StringBuilder();
        for (String o : t.split("(?<=[.!?])\\s+")) {
            if (b.length() > 0 && b.length() + o.length() > 3000) { out.add(b.toString()); b.setLength(0); }
            if (b.length() > 0) b.append(' ');
            b.append(o);
        }
        if (b.length() > 0) out.add(b.toString());
        return out;
    }

    private void enviarError(String msg) {
        web.evaluateJavascript("window.onVozError && window.onVozError(" + JSONObject.quote(msg) + ")", null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (reconocedor != null) reconocedor.destroy();
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    /** Funciones que la página puede llamar como Android.saveFile(...), Android.speak(...), Android.listen(...). */
    private class Bridge {

        @JavascriptInterface
        public String saveFile(String base64, String name, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                boolean image = mime.startsWith("image/");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, (image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_MUSIC) + "/AprendeYJuega");
                    Uri collection = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                    Uri uri = getContentResolver().insert(collection, v);
                    if (uri == null) return "No se pudo guardar";
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        os.write(bytes);
                    }
                    return (image ? "Guardado en Galería › Pictures/AprendeYJuega" : "Guardado en Música › AprendeYJuega") + ": " + name;
                } else {
                    File dir = getExternalFilesDir(image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_MUSIC);
                    File f = new File(dir, name);
                    try (FileOutputStream os = new FileOutputStream(f)) {
                        os.write(bytes);
                    }
                    return "Guardado: " + f.getAbsolutePath();
                }
            } catch (Exception e) {
                return "No se pudo guardar: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public void speak(String text) {
            hablar(text, "es-CO", 0.95f);
        }

        /** Lee en otro idioma, por ejemplo "en-US" para Teacher Owl. velocidad: 0.6 lento, 0.9 normal. */
        @JavascriptInterface
        public void speakLang(String text, String idioma, float velocidad) {
            hablar(text, idioma, velocidad);
        }

        /** Lee varias frases seguidas, cada una en su idioma: [{"t":"texto","l":"es-CO","v":1}, ...] */
        @JavascriptInterface
        public void speakSeq(String json) {
            ArrayList<String[]> nueva = new ArrayList<>();
            try {
                JSONArray arr = new JSONArray(json);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    nueva.add(new String[]{o.optString("t"), o.optString("l", "es-CO"), String.valueOf((float) o.optDouble("v", 1))});
                }
            } catch (JSONException e) {
                return;
            }
            runOnUiThread(() -> hablarCola(nueva));
        }
        @JavascriptInterface
        public void stopSpeak() {
            turnoCola++;
            runOnUiThread(() -> { if (tts != null) tts.stop(); });
        }
        @JavascriptInterface
        public boolean canListen() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }

        @JavascriptInterface
        public void listen(String idioma) {
            runOnUiThread(() -> escuchar(idioma));
        }

        private void hablar(String text, String idioma, float velocidad) {
            if (text == null) return;
            ArrayList<String[]> uno = new ArrayList<>();
            uno.add(new String[]{text, idioma, String.valueOf(velocidad)});
            runOnUiThread(() -> hablarCola(uno));
        }
    }
}
