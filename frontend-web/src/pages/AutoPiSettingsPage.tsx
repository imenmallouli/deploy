import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAutoPiSettings, updateAutoPiSettings } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

type FormState = {
  enabled: boolean;
  email: string;
  password: string;
  device_id: string;
  mqtt_host: string;
  mqtt_port: string;
  qos: string;
  mqtt_username: string;
  mqtt_password: string;
  verbose: boolean;
};

const defaultForm: FormState = {
  enabled: false,
  email: '',
  password: '',
  device_id: '',
  mqtt_host: 'broker.emqx.io',
  mqtt_port: '1883',
  qos: '1',
  mqtt_username: '',
  mqtt_password: '',
  verbose: false,
};

export function AutoPiSettingsPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        saveFailed: 'Echec de sauvegarde AutoPi',
        saveSuccess: 'Configuration AutoPi sauvegardee. Le bridge a ete relance automatiquement.',
        title: 'Parametres AutoPi',
        subtitle: 'Configurez une seule fois la connexion cloud. Les utilisateurs n\'ont rien a saisir ensuite.',
        bridgeActive: 'Bridge actif',
        bridgeInactive: 'Bridge inactif',
        cloudConnection: 'Connexion Cloud',
        refreshing: 'Actualisation...',
        refresh: 'Actualiser',
        enableReading: 'Activer la lecture automatique AutoPi au demarrage backend',
        autopiEmail: 'Email AutoPi',
        autopiPassword: 'Mot de passe AutoPi',
        keepPassword: 'Laisser vide pour garder le mot de passe actuel',
        password: 'Mot de passe',
        dongleId: 'ID reel du dongle',
        mqttHost: 'Hote MQTT',
        mqttPort: 'Port MQTT',
        mqttUser: 'Utilisateur MQTT',
        mqttPassword: 'Mot de passe MQTT',
        optional: 'Optionnel',
        keepMqttPassword: 'Laisser vide pour garder le mot de passe MQTT actuel',
        verboseLogs: 'Activer les logs detailles du bridge',
        saving: 'Sauvegarde...',
        saveRestart: 'Sauvegarder et relancer',
        howItWorks: 'Comment ca marche',
        step1: 'L\'admin remplit ce formulaire une seule fois.',
        step2: 'Le backend sauvegarde la configuration cote serveur.',
        step3: 'Le bridge MQTT est relance automatiquement apres sauvegarde.',
        step4: 'L\'utilisateur normal branche le dongle et consulte les donnees sans toucher au code.',
        important: 'Important',
        note: 'Le vehicule doit rester lie au bon dongle dans les pages Vehicles ou Devices pour que l\'ingestion soit acceptee.',
      }
    : {
        saveFailed: 'AutoPi save failed',
        saveSuccess: 'AutoPi configuration saved. Bridge was restarted automatically.',
        title: 'AutoPi Settings',
        subtitle: 'Configure cloud connection once. Users will not need to type anything after that.',
        bridgeActive: 'Bridge active',
        bridgeInactive: 'Bridge inactive',
        cloudConnection: 'Cloud Connection',
        refreshing: 'Refreshing...',
        refresh: 'Refresh',
        enableReading: 'Enable AutoPi automatic reading at backend startup',
        autopiEmail: 'AutoPi Email',
        autopiPassword: 'AutoPi Password',
        keepPassword: 'Leave empty to keep current password',
        password: 'Password',
        dongleId: 'Real dongle ID',
        mqttHost: 'MQTT host',
        mqttPort: 'MQTT port',
        mqttUser: 'MQTT username',
        mqttPassword: 'MQTT password',
        optional: 'Optional',
        keepMqttPassword: 'Leave empty to keep current MQTT password',
        verboseLogs: 'Enable verbose bridge logs',
        saving: 'Saving...',
        saveRestart: 'Save and restart',
        howItWorks: 'How it works',
        step1: 'Admin fills this form one time only.',
        step2: 'Backend stores the server-side configuration.',
        step3: 'MQTT bridge is automatically restarted after save.',
        step4: 'Standard user plugs in the dongle and reads data without touching code.',
        important: 'Important',
        note: 'Vehicle must stay linked to the correct dongle in Vehicles or Devices pages so ingestion is accepted.',
      };
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [message, setMessage] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['autopi-settings'],
    queryFn: getAutoPiSettings,
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    setForm({
      enabled: settingsQuery.data.enabled,
      email: settingsQuery.data.email ?? '',
      password: '',
      device_id: settingsQuery.data.device_id ?? '',
      mqtt_host: settingsQuery.data.mqtt_host || 'broker.emqx.io',
      mqtt_port: String(settingsQuery.data.mqtt_port || 1883),
      qos: String(settingsQuery.data.qos || 1),
      mqtt_username: settingsQuery.data.mqtt_username ?? '',
      mqtt_password: '',
      verbose: settingsQuery.data.verbose,
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await updateAutoPiSettings({
        enabled: form.enabled,
        email: form.email.trim(),
        password: form.password.trim() || undefined,
        device_id: form.device_id.trim(),
        mqtt_host: form.mqtt_host.trim() || 'broker.emqx.io',
        mqtt_port: Number(form.mqtt_port),
        qos: Number(form.qos),
        mqtt_username: form.mqtt_username.trim() || undefined,
        mqtt_password: form.mqtt_password.trim() || undefined,
        verbose: form.verbose,
      });

      if (response.status !== 'success') {
        throw new Error(response.message || text.saveFailed);
      }

      return response;
    },
    onSuccess: async () => {
      setMessage(text.saveSuccess);
      setForm((current) => ({ ...current, password: '', mqtt_password: '' }));
      await queryClient.invalidateQueries({ queryKey: ['autopi-settings'] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    },
  });

  return (
    <section className="autopi-page">
      <div className="autopi-header">
        <div>
          <h2 className="autopi-title">{text.title}</h2>
          <p className="autopi-subtitle">{text.subtitle}</p>
        </div>
        <div className={`autopi-status ${form.enabled ? 'is-enabled' : 'is-disabled'}`}>
          {form.enabled ? text.bridgeActive : text.bridgeInactive}
        </div>
      </div>

      <div className="autopi-grid">
        <article className="autopi-card">
          <div className="panel-title-row">
            <h3>{text.cloudConnection}</h3>
            <button
              type="button"
              className="autopi-refresh-btn"
              onClick={() => settingsQuery.refetch()}
              disabled={settingsQuery.isFetching}
            >
              {settingsQuery.isFetching ? text.refreshing : text.refresh}
            </button>
          </div>

          <form
            className="autopi-form"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage('');
              saveMutation.mutate();
            }}
          >
            <label className="autopi-toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <span>{text.enableReading}</span>
            </label>

            <div className="autopi-field-grid">
              <label className="autopi-field">
                <span>{text.autopiEmail}</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="admin@autopi.io"
                />
              </label>

              <label className="autopi-field">
                <span>{text.autopiPassword}</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={settingsQuery.data?.has_password ? text.keepPassword : text.password}
                />
              </label>

              <label className="autopi-field">
                <span>{text.dongleId}</span>
                <input
                  value={form.device_id}
                  onChange={(event) => setForm((current) => ({ ...current, device_id: event.target.value }))}
                  placeholder="c917fc1199ff"
                />
              </label>

              <label className="autopi-field">
                <span>{text.mqttHost}</span>
                <input
                  value={form.mqtt_host}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_host: event.target.value }))}
                  placeholder="broker.emqx.io"
                />
              </label>

              <label className="autopi-field">
                <span>{text.mqttPort}</span>
                <input
                  type="number"
                  value={form.mqtt_port}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_port: event.target.value }))}
                  min="1"
                />
              </label>

              <label className="autopi-field">
                <span>QoS</span>
                <select
                  value={form.qos}
                  onChange={(event) => setForm((current) => ({ ...current, qos: event.target.value }))}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </label>

              <label className="autopi-field">
                <span>{text.mqttUser}</span>
                <input
                  value={form.mqtt_username}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_username: event.target.value }))}
                  placeholder={text.optional}
                />
              </label>

              <label className="autopi-field">
                <span>{text.mqttPassword}</span>
                <input
                  type="password"
                  value={form.mqtt_password}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_password: event.target.value }))}
                  placeholder={settingsQuery.data?.has_mqtt_password ? text.keepMqttPassword : text.optional}
                />
              </label>
            </div>

            <label className="autopi-toggle-row">
              <input
                type="checkbox"
                checked={form.verbose}
                onChange={(event) => setForm((current) => ({ ...current, verbose: event.target.checked }))}
              />
              <span>{text.verboseLogs}</span>
            </label>

            <div className="autopi-actions">
              <button type="submit" className="autopi-save-btn" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? text.saving : text.saveRestart}
              </button>
            </div>
          </form>

          {message && <p className="autopi-message">{message}</p>}
        </article>

      </div>
    </section>
  );
}