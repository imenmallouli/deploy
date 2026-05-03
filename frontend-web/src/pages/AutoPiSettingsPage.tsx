import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAutoPiSettings, updateAutoPiSettings } from '../lib/api/endpoints';

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
        throw new Error(response.message || 'Echec de sauvegarde AutoPi');
      }

      return response;
    },
    onSuccess: async () => {
      setMessage('Configuration AutoPi sauvegardee. Le bridge a ete relance automatiquement.');
      setForm((current) => ({ ...current, password: '', mqtt_password: '' }));
      await queryClient.invalidateQueries({ queryKey: ['autopi-settings'] });
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Echec de sauvegarde AutoPi');
    },
  });

  return (
    <section className="autopi-page">
      <div className="autopi-header">
        <div>
          <h2 className="autopi-title">AutoPi Settings</h2>
          <p className="autopi-subtitle">Configure une seule fois la connexion cloud. Les utilisateurs n’ont rien a saisir ensuite.</p>
        </div>
        <div className={`autopi-status ${form.enabled ? 'is-enabled' : 'is-disabled'}`}>
          {form.enabled ? 'Bridge active' : 'Bridge inactive'}
        </div>
      </div>

      <div className="autopi-grid">
        <article className="autopi-card">
          <div className="panel-title-row">
            <h3>Connexion Cloud</h3>
            <button
              type="button"
              className="autopi-refresh-btn"
              onClick={() => settingsQuery.refetch()}
              disabled={settingsQuery.isFetching}
            >
              {settingsQuery.isFetching ? 'Actualisation...' : 'Actualiser'}
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
              <span>Activer la lecture automatique AutoPi au demarrage backend</span>
            </label>

            <div className="autopi-field-grid">
              <label className="autopi-field">
                <span>Email AutoPi</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="admin@autopi.io"
                />
              </label>

              <label className="autopi-field">
                <span>Mot de passe AutoPi</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={settingsQuery.data?.has_password ? 'Laisser vide pour garder le mot de passe actuel' : 'Mot de passe'}
                />
              </label>

              <label className="autopi-field">
                <span>ID reel du dongle</span>
                <input
                  value={form.device_id}
                  onChange={(event) => setForm((current) => ({ ...current, device_id: event.target.value }))}
                  placeholder="c917fc1199ff"
                />
              </label>

              <label className="autopi-field">
                <span>MQTT host</span>
                <input
                  value={form.mqtt_host}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_host: event.target.value }))}
                  placeholder="broker.emqx.io"
                />
              </label>

              <label className="autopi-field">
                <span>MQTT port</span>
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
                <span>MQTT username</span>
                <input
                  value={form.mqtt_username}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_username: event.target.value }))}
                  placeholder="Optionnel"
                />
              </label>

              <label className="autopi-field">
                <span>MQTT password</span>
                <input
                  type="password"
                  value={form.mqtt_password}
                  onChange={(event) => setForm((current) => ({ ...current, mqtt_password: event.target.value }))}
                  placeholder={settingsQuery.data?.has_mqtt_password ? 'Laisser vide pour garder le mot de passe MQTT actuel' : 'Optionnel'}
                />
              </label>
            </div>

            <label className="autopi-toggle-row">
              <input
                type="checkbox"
                checked={form.verbose}
                onChange={(event) => setForm((current) => ({ ...current, verbose: event.target.checked }))}
              />
              <span>Activer les logs detailles du bridge</span>
            </label>

            <div className="autopi-actions">
              <button type="submit" className="autopi-save-btn" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder et relancer'}
              </button>
            </div>
          </form>

          {message && <p className="autopi-message">{message}</p>}
        </article>

        <article className="autopi-card autopi-help-card">
          <h3>Comment ca marche</h3>
          <ul className="autopi-help-list">
            <li>L’admin remplit ce formulaire une seule fois.</li>
            <li>Le backend sauvegarde la configuration cote serveur.</li>
            <li>Le bridge MQTT est relance automatiquement apres sauvegarde.</li>
            <li>L’utilisateur normal branche le dongle et consulte les donnees sans toucher au code.</li>
          </ul>

          <div className="autopi-note-box">
            <strong>Important</strong>
            <p>Le vehicule doit rester lie au bon dongle dans les pages Vehicles ou Devices pour que l’ingestion soit acceptee.</p>
          </div>
        </article>
      </div>
    </section>
  );
}