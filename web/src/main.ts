import './estilos.css';
import { AlmacenArchivoLocal } from './almacen';
import { Estado } from './estado';
import { iniciarApp } from './ui/app';

const estado = new Estado(new AlmacenArchivoLocal());
iniciarApp(document.getElementById('app')!, estado);
void estado.cargar();
