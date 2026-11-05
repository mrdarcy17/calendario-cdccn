import { describe, expect, it } from 'vitest';
import { CONFIG_INICIAL, crearHuella, debeBloquearAlSalir, normalizar, pinValido, verificarPin } from '../seguridad.ts';

describe('PIN', () => {
  it('solo acepta 4 dígitos', () => {
    expect(pinValido('1234')).toBe(true);
    expect(pinValido('0000')).toBe(true);
    for (const malo of ['123', '12345', '12a4', '', ' 123']) expect(pinValido(malo)).toBe(false);
  });

  it('no guarda el PIN, solo su huella, y la verifica', async () => {
    const h = await crearHuella('2580');
    expect(JSON.stringify(h)).not.toContain('2580');
    expect(await verificarPin('2580', h)).toBe(true);
    expect(await verificarPin('2581', h)).toBe(false);
    expect(await verificarPin('258', h)).toBe(false);
  });

  it('el mismo PIN da huellas distintas (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([crearHuella('1111'), crearHuella('1111')]);
    expect(a.hash).not.toBe(b.hash);
    expect(await verificarPin('1111', a)).toBe(true);
    expect(await verificarPin('1111', b)).toBe(true);
  });

  it('rechaza crear un PIN inválido', async () => {
    await expect(crearHuella('12')).rejects.toThrow('4 dígitos');
  });
});

describe('bloqueo al salir de la app', () => {
  it('en modo protegido siempre se bloquea, sin tiempo de espera', async () => {
    expect(debeBloquearAlSalir({ modo: 'protegido', pin: await crearHuella('1234'), huellaAlEntrar: false })).toBe(true);
  });

  it('en modo libre nunca bloquea', () => {
    expect(debeBloquearAlSalir(CONFIG_INICIAL)).toBe(false);
  });
});

describe('configuración guardada', () => {
  it('ante datos raros vuelve a modo libre (nunca deja la app inutilizable)', async () => {
    expect(normalizar(null)).toEqual(CONFIG_INICIAL);
    expect(normalizar({ modo: 'protegido', pin: null })).toEqual(CONFIG_INICIAL);
    expect(normalizar({ modo: 'protegido', pin: { sal: 1 } })).toEqual(CONFIG_INICIAL);
    const pin = await crearHuella('4321');
    expect(normalizar({ modo: 'protegido', pin })).toEqual({ modo: 'protegido', pin, huellaAlEntrar: false });
    expect(normalizar({ modo: 'protegido', pin, huellaAlEntrar: true })).toEqual({ modo: 'protegido', pin, huellaAlEntrar: true });
  });
});
