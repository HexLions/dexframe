# DexFrame and Home Assistant

DexFrame has a small HTTP API (see the README), so Home Assistant can read it and drive it
without any custom integration. Replace `dexframe.local` with the board's address, and add
`?key=…` (or `&key=…`) to every POST if you set an admin key.

## Sensors: battery, counter, page on screen

```yaml
# configuration.yaml
rest:
  - resource: http://dexframe.local/api/info
    scan_interval: 300
    sensor:
      - name: DexFrame battery
        unique_id: dexframe_battery
        value_template: "{{ (value_json.batteryMv / 1000) | round(2) if value_json.batteryMv > 1000 else none }}"
        unit_of_measurement: V
        device_class: voltage
      - name: DexFrame shiny counter
        unique_id: dexframe_counter
        value_template: "{{ value_json.counter }}"
      - name: DexFrame page
        unique_id: dexframe_page
        value_template: "{{ value_json.current + 1 }} / {{ value_json.entries }}"
```

With power saving on, the board is offline between wakes: the sensors go `unavailable`
until the next button press or power-on. Keep power saving off for a live dashboard.

## Buttons and actions

```yaml
rest_command:
  dexframe_next:
    url: http://dexframe.local/api/next
    method: post
  dexframe_show:                # data: {slot: 3} — rotation entry, from 0
    url: "http://dexframe.local/api/show?slot={{ slot }}"
    method: post
  dexframe_counter_add:         # data: {n: 1}
    url: "http://dexframe.local/api/counter?add={{ n }}"
    method: post
  dexframe_refresh:
    url: http://dexframe.local/api/refresh
    method: post
  dexframe_push_clear:
    url: http://dexframe.local/api/push/clear
    method: post
```

## Showing a message or a picture

`tools/push.py` turns a picture or a text into a page for the board's panel and sends it
to `/api/push`; the board shows it at once and goes back to the rotation after `--min`
minutes (or at the next page change). It needs Python 3 with Pillow on the machine that
runs it.

```yaml
shell_command:
  dexframe_message: >-
    python3 /config/scripts/push.py --host dexframe.local
    --title "{{ title }}" --text "{{ message }}" --min {{ minutes | default(30) }}
  dexframe_picture: >-
    python3 /config/scripts/push.py --host dexframe.local
    --image "{{ path }}" --min {{ minutes | default(30) }}
```

```yaml
# an automation action
action: shell_command.dexframe_message
data:
  title: Doorbell
  message: Someone is at the door
  minutes: 5
```

Copy `tools/push.py` to `/config/scripts/`. In Home Assistant OS the shell commands run in
the core container: if Pillow is missing there, run the script from another machine (or a
container that has it) and call it over SSH, or install it with the
[pyscript](https://github.com/custom-components/pyscript) or AppDaemon add-ons.
