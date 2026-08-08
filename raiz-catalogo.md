# RAÍZ — Catálogo de diseño

Inventario completo de verbos, materia, objetos, objetos compuestos, estructuras, fauna y sistemas.
Sirve como base para decidir qué se implementa y en qué orden. No todo entra: primero el catálogo, luego el recorte.

---

## 0. Estado actual (qué existe ya)

| Sistema | Estado |
|---|---|
| Mundo por chunks, 6 biomas, 5 especies de árbol | hecho |
| Ciclo día/noche, meteo, viento, dosel, sensación térmica | hecho |
| Termorregulación, hidratación, energía, vigor, salud | hecho |
| Recolectar del suelo, desramar, talar, tocones | hecho |
| Fabricación con calidad (mínimo laxo + mejoras) | hecho |
| Hoguera, refugio, cama, trampa; dormir | hecho |
| Mochila con capacidad | hecho |
| Manos, equipar, barra rápida, herramienta visible | hecho |
| Nadar, vadear, agacharse, ruido propio | hecho |
| Fauna (conejo, corzo) con alerta y huida; caza a lanza; despiece | hecho |
| Pesca a lanza, cocinar carne y pescado, secadero, cecina | hecho |
| Hierba alta y baja, maleza, troncos caídos, tocones huecos, pedruscos | hecho |
| Audio sintetizado: viento, lluvia, fuego, arroyo, pasos, aves | hecho |
| Persistencia total (diff del mundo) y calidad gráfica configurable | hecho |
| Construcción modular de base (postes, vigas, zarzo, cubierta — ya da abrigo real) | parcial |
| Desmontar, mover y reforzar calidad — cualquier estructura (fogata, refugio, cama, trampa, recogedor, filtro, secadero, piezas modulares) | hecho |
| Cerámica, huerto, estaciones | pendiente |

---

## 1. Principios

1. **Verbos antes que objetos.** Un objeto sin acción propia no debería existir.
2. **Nada es binario.** Todo tiene calidad, humedad, desgaste y estado. Se puede hacer mal y funcionar peor.
3. **El lugar manda.** Lo que encuentras, lo que puedes construir y lo que te protege depende de dónde estés.
4. **El bosque esconde.** La hierba baja tapa los materiales: hay que rebuscar, no barrer con la vista.
5. **Todo se degrada.** La madera se moja, la comida se pudre, las ligaduras se aflojan, el filo se embota.

---

## 2. Estado del jugador

### Constantes vitales
| Constante | Rango | Sube con | Baja con |
|---|---|---|---|
| Salud | 0–100 | descanso, comida, calor | frío, hambre, sed, intoxicación, heridas |
| Temperatura corporal | 30–39,5 °C | fuego, abrigo, refugio, movimiento, comida caliente | frío, viento, humedad, inmersión, noche |
| Energía (calorías) | 0–100 | comer | esfuerzo, frío, tiempo |
| Hidratación | 0–100 | beber | esfuerzo, calor, sudor |
| Vigor | 0–100 | descanso | correr, talar, cavar, cargar peso |

### Estados añadidos (nuevos)
| Estado | Efecto | Se quita con |
|---|---|---|
| Mojado (0–1) | pérdida de calor | fuego, refugio, tiempo, capa |
| Sucio | atrae insectos, empeora heridas | lavarse en agua |
| Herido (corte) | sangrado leve, ‑vigor | vendaje de fibra/musgo |
| Intoxicado | ‑salud progresiva | tiempo, agua, carbón vegetal |
| Ampollas | ‑velocidad | descanso, calzado reparado |
| Hambre crónica | ‑máx. vigor | comer varios días |
| Peso de carga | ‑velocidad, +vigor consumido | soltar cosas, zurrón mejor |
| Descansado | +vigor máx., +precisión | dormir bien |

---

## 3. Catálogo de verbos

### Verbos sobre el mundo
| Verbo | Requiere | Sobre | Resultado |
|---|---|---|---|
| Examinar | — | cualquier cosa | ficha: qué es, estado, usos |
| Recoger | mano libre | objeto suelto | va a mochila |
| Rebuscar | — | hierba, hojarasca, tocón hueco | materiales escondidos aleatorios |
| Arrancar | mano / cuchillo | ortiga, junco, musgo, hierba | fibra, junco, musgo, yesca |
| Cortar rama | cuchillo | árbol vivo | palos, corteza, resina, agujas |
| Pelar corteza | cuchillo | abedul, tilo, tocón | corteza (externa: yesca / interna: fibra y comida) |
| Talar | hacha | árbol | tronco → leña, ramas |
| Trocear | hacha | tronco caído, tocón | leña, tablas toscas |
| Astillar | cuchillo/hacha | leña seca | astillas (paso intermedio del fuego) |
| Cavar | palo cavador, mano | suelo blando, madriguera | raíces, arcilla, gusanos, hoyo |
| Levantar piedra | mano | piedras grandes | insectos, larvas, sílex |
| Golpear | piedra/mazo | sílex, nuez, hueso | lascas, semilla, tuétano |
| Beber | recipiente/mano | agua | hidratación (riesgo si cruda) |
| Llenar | recipiente | agua | agua sin tratar |
| Lavar | agua | jugador, ropa, alimento | quita sucio |
| Vadear/nadar | — | agua | mojado 100 %, riesgo |
| Rastrear | conocimiento | huellas, excrementos, pelo | dirección y frescura de la pieza |
| Acechar | agachado | animal | acercarse sin espantarlo |
| Lanzar | lanza/piedra | animal, objetivo | caza |
| Tender | trampa | lugar con rastro | trampa armada |
| Revisar | — | trampa, nasa, sedal | pieza o nada |
| Despiezar | cuchillo | animal muerto | carne, piel, tendón, hueso, grasa |
| Escuchar | quieto | entorno | pistas: agua cerca, animales, tormenta |
| Orientarse | sol, musgo, estrellas | — | rumbo aproximado |
| Marcar | cuchillo | árbol | señal en el mapa mental |

### Verbos sobre el fuego
| Verbo | Requiere | Resultado |
|---|---|---|
| Preparar hogar | piedras / hoyo | base de fuego, calidad según preparación |
| Encender | ferrocerio, arco, sílex+pirita | ignición (probabilidad por humedad, viento, yesca) |
| Avivar | soplar / abanico | acelera fase de llama |
| Alimentar | astillas, palos, leña | prolonga duración |
| Cubrir | corteza, piedras reflectoras | resiste lluvia, dirige calor |
| Apagar | agua, tierra | fin |
| Sacar brasas | recipiente de corteza | transportar fuego |
| Hacer carbón | fuego cubierto | carbón (filtro de agua, dibujar) |

### Verbos sobre objetos
| Verbo | Notas |
|---|---|
| Equipar en mano derecha / izquierda | cuchillo, hacha, antorcha, lanza, caña |
| Vestir | capa, calzado, sombrero, esterilla enrollada |
| Usar | comer, beber, aplicar (vendaje), leer |
| Combinar | dos objetos → objeto compuesto |
| Desmontar | recuperar parte de las piezas |
| Reparar | con la misma ligadura/material, recupera desgaste |
| Afilar | piedra de afilar; recupera filo |
| Secar | junto al fuego o al sol; quita humedad |
| Soltar | dejar en el suelo (persiste) |
| Almacenar | en refugio, cesto o despensa elevada |

---

## 4. Materia prima por zona

| Material | Claro | Pinar | Espesura | Ribera | Roquedo | Obtención |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Palo | ● | ●● | ●● | ● | ○ | suelo, desramar |
| Leña | ○ | ●● | ●● | ● | ○ | talar, tronco caído |
| Astillas | — | — | — | — | — | astillar leña |
| Yesca (hojarasca) | ● | ●●● | ●● | ○ | ● | suelo, rebuscar |
| Corteza de abedul | ○ | ● | ●● | ●● | ○ | pelar |
| Resina | — | ●●● | ● | — | ○ | pinos y abetos |
| Agujas de pino | — | ●●● | ○ | — | ● | suelo (infusión, cama) |
| Fibra de ortiga | ●●● | ○ | ●● | ●● | — | arrancar |
| Junco | — | — | ○ | ●●● | — | ribera |
| Musgo | ○ | ●● | ●●● | ●● | ● | suelo, rocas |
| Hierba seca | ●●● | ● | ○ | ● | ● | segar |
| Piedra | ●● | ● | ○ | ●● | ●●● | suelo |
| Sílex | — | ○ | — | ● | ●●● | roquedo, cauce |
| Arcilla | — | — | — | ●●● | — | cavar en orilla |
| Arena | — | — | — | ●● | ○ | orilla |
| Bayas | ●● | ○ | ●● | ● | ○ | arbustos (estacional) |
| Setas | — | ●● | ●●● | ● | — | suelo (identificar) |
| Bellotas | ● | — | ●●● | ○ | — | robles (lixiviar) |
| Raíces | ●● | ○ | ● | ●● | — | cavar |
| Ortiga tierna | ●● | — | ● | ●● | — | comestible cocida |
| Gusanos/larvas | ○ | ● | ●● | ●● | ○ | cavar, tocones, piedras |
| Plumas | ○ | ● | ● | ●● | ● | suelo, aves |
| Hueso / asta | ○ | ○ | ● | ○ | ● | despiece, carroña |

● = frecuente ○ = raro — = no aparece

### Estados de la materia
- **Verde ↔ seco**: madera verde no arde pero no se parte; seca arde y es frágil.
- **Mojado ↔ seco**: todo se moja bajo lluvia; secar junto al fuego lleva tiempo.
- **Crudo → cocinado → ahumado → seco → podrido**: la comida avanza por su cuenta.
- **Nuevo → gastado → roto**: herramientas y ropa.

---

## 5. Objetos compuestos (objetos de objetos)

Toda herramienta es **cabeza + mango + ligadura**. Cada pieza aporta calidad y define durabilidad.

| Herramienta | Cabeza | Mango | Ligadura | Función |
|---|---|---|---|---|
| Hacha de mano | piedra / sílex / hueso | palo grueso / rama de roble | cordel / tendón / resina | talar, trocear |
| Cuchillo de sílex | lasca | asta / madera | resina + cordel | cortar, despiezar |
| Lanza | punta de sílex / madera endurecida al fuego | vara recta | tendón | caza, pesca |
| Maza | piedra redonda | palo | cordel doble | romper hueso, clavar |
| Palo cavador | punta endurecida | — | — | raíces, arcilla |
| Arco de fricción | — | arco (vara + cordel), taladro, base, apoyo | — | fuego sin ferrocerio |
| Caña | vara flexible | sedal (fibra/tendón) | anzuelo (hueso/espina) | pesca |
| Nasa | juncos trenzados | — | cordel | pesca pasiva |
| Cesto | juncos / corteza | — | cordel | almacenaje, transporte |
| Recipiente de corteza | corteza doblada | — | resina (sellado) | hervir con piedras, llevar agua |
| Olla de barro | arcilla cocida | — | — | hervir directo al fuego |
| Piedra de afilar | arenisca | — | — | recuperar filo |

### Ropa y equipo
| Prenda | Piezas | Efecto |
|---|---|---|
| Capa | corteza + musgo + cordel | aislamiento, repele agua |
| Calzado envuelto | piel / corteza + fibra | evita ampollas y frío por los pies |
| Sombrero de juncos | juncos + cordel | lluvia y sol |
| Esterilla enrollable | juncos | cama portátil |
| Zurrón | corteza / piel + cordel | capacidad |
| Cinturón | cordel | acceso rápido a 2 objetos |

---

## 6. Estructuras y refugios según el lugar

| Refugio | Dónde | Materiales mínimos | Fuerte en |
|---|---|---|---|
| Lean-to (una vertiente) | cualquier sitio con dos apoyos | 5 palos | rápido, malo con viento cruzado |
| Cabaña de hojarasca | espesura | palos + brazadas de hojas | frío; el mejor sin fuego |
| Bajo tronco caído | donde haya tronco | ramas + hojas | rapidísimo, poco espacio |
| Abrigo rocoso | roquedo | piedras + ramas | tormenta, muy duradero |
| Refugio de juncos | ribera | juncos + palos | fresco, malo con frío |
| Vivac bajo abeto | pinar | ramas bajas | emergencia, cero coste |
| Tienda de corteza | donde haya abedules | corteza + palos + cordel | lluvia total |

### Otras construcciones
| Construcción | Para qué |
|---|---|
| Hogar con reflector de piedras | calor dirigido a la cama, menos consumo |
| Secadero | secar ropa, carne, madera |
| Ahumadero | conservar carne y pescado |
| Despensa elevada | comida a salvo de animales |
| Percha / tendedero | secar ropa junto al fuego |
| Zanja de drenaje | evita cama encharcada |
| Empalizada baja | disuade jabalíes |
| Pozo de filtrado (arena+carbón) | agua potable sin hervir |
| Cesto trampa para peces | pesca pasiva |

---

## 7. Fuego en detalle

**Fases:** chispa → yesca → astillas → palos → leña → brasas.
Saltarse una fase = fallo.

| Variable | Efecto |
|---|---|
| Humedad de la yesca | probabilidad de prender |
| Viento | apaga la chispa, aviva la llama |
| Tipo de fuego (tipi / cabaña / estrella) | rápido y luminoso vs. lento y duradero |
| Piedras alrededor | conserva calor, protege del viento |
| Reflector | duplica el calor aprovechado |
| Techo encima | sobrevive a la lluvia |
| Leña verde | humo (ahumar, ahuyentar insectos) |

**Yescas por calidad:** corteza de abedul > resina > hierba seca > hojarasca > musgo seco.

---

## 8. Agua

| Fuente | Riesgo | Tratamiento |
|---|---|---|
| Arroyo corriente | bajo | hervir mejora |
| Charca estancada | alto | hervir obligatorio |
| Lluvia recogida | nulo | ninguno |
| Rocío en tela | nulo | lento |
| Nieve derretida | nulo | consume combustible |

Tratamientos: hervir (recipiente + fuego), filtrar (arena + carbón + tela), decantar.

---

## 9. Comida

### Forrajeo
Bayas, setas (con identificación por conocimiento), bellotas (requieren lixiviado en agua), raíces, ortiga (cocida), brotes, frutos secos, huevos de nido, larvas.

### Caza
| Pieza | Dónde | Cómo | Rinde |
|---|---|---|---|
| Conejo | claros, lindes | lazo, trampa paiute, lanza | carne, piel, tendón |
| Ardilla | pinar | trampa de palo, honda | carne poca |
| Ave (perdiz, pato) | claro / ribera | trampa, lanza, piedra | carne, plumas |
| Corzo | espesura | acecho + lanza, trampa grande | mucha carne, piel grande, asta |
| Jabalí | espesura | peligroso; requiere lanza buena | mucha carne y grasa; puede cargar |
| Pez (trucha, barbo) | ribera | caña, nasa, lanza | carne magra |
| Rana / cangrejo | ribera | mano, nasa | poco pero fácil |

Ciclo de caza: **rastro → acecho → lance → seguimiento del rastro de sangre → despiece → transporte**.

### Cocina y conservación
| Método | Requiere | Efecto |
|---|---|---|
| Asar a la brasa | fuego | +calorías, rápido, algo de pérdida |
| Hervir | recipiente | máximo aprovechamiento, caldo caliente (+temperatura) |
| Ahumar | ahumadero, leña verde | conserva días |
| Secar al sol/viento | secadero | conserva, pierde sabor |
| Salar | sal (rara) | conserva mucho |
| Enterrar en frío | hoyo sombrío | conserva poco |

Estados: crudo → cocinado → ahumado → rancio → podrido. Comer crudo o podrido = intoxicación.

---

## 10. Fauna y vida

| Animal | Comportamiento | Señales |
|---|---|---|
| Conejo | huye al detectarte; activo al alba y ocaso | excrementos, senderos en la hierba |
| Corzo | muy asustadizo, olfato; sigue el viento | huellas hendidas, ramoneo |
| Jabalí | agresivo si acorralado | hozaduras, barro en troncos |
| Zorro | roba comida no protegida | huellas, restos |
| Lobo (raro) | manada, evita el fuego | aullidos de noche |
| Aves | alarma al acercarte (delatan tu posición) | vuelo repentino |
| Insectos | molestan sin humo | zumbido |

Reglas: el viento lleva tu olor; correr espanta; el fuego aleja de noche pero delata.

---

## 11. Detalle del mundo (lo que falta ver)

| Elemento | Función | Prioridad |
|---|---|---|
| **Hierba baja universal** | oculta piedras y materiales; obliga a rebuscar | alta |
| Hojarasca por zonas | yesca, esconde cosas, hace ruido al pisar | alta |
| Troncos caídos | leña abundante, refugio, cruzar arroyos | alta |
| Tocones huecos | rebuscar: larvas, yesca, agua de lluvia | media |
| Rocas grandes y salientes | abrigo rocoso, sílex, sombra | media |
| Arroyos con cauce real | agua corriente, peces, arcilla, guijarros | alta |
| Zarzas y matorral | frenan el paso, arañan, dan bayas | media |
| Claros con flores y helechos | forrajeo, visibilidad | media |
| Madrigueras | caza, trampas | media |
| Nidos en árboles | huevos, plumas | baja |
| Setas al pie de los troncos | forrajeo localizado | media |
| Charcas y barrizales | agua sucia, huellas de animales | media |
| Niebla en hondonadas al alba | atmósfera, visibilidad | baja |
| Sendas de animales | rastreo, orientación | media |

---

## 12. Interfaz

| Elemento | Qué resuelve |
|---|---|
| **Manos (izquierda/derecha)** | qué llevas equipado; el modelo se ve en pantalla |
| **Barra rápida (1–5)** | cuchillo, hacha, antorcha, comida, agua |
| **Rueda de acciones** (mantener E) | cuando un objeto admite varias acciones |
| **Ficha de objeto** | al examinar: estado, humedad, desgaste, usos posibles |
| Mochila con peso y volumen | decidir qué llevas |
| Libreta: zurrón / fabricar / saber / diario | consulta |
| Diario de días | qué pasó cada jornada |
| Indicadores diegéticos | mirar al cielo para el tiempo, al musgo para el norte |

---

## 13. Progresión

**Conocimiento** (se desbloquea haciendo, no comprando):
fuego → cordel → herramientas → refugio → trampas → caza mayor → cerámica → conservación.

**Ritmo esperado por día:**
1. Día 1: agua, yesca, fuego malo, refugio malo.
2. Día 2: cordel, hacha, leña de verdad, refugio decente.
3. Día 3: trampas, primera carne, cama, capa.
4. Día 4–5: recipiente, hervir, conservar, ahumadero.
5. Día 6+: caza mayor, piel, campamento estable.

---

## 14. Sistemas transversales

| Sistema | Regla |
|---|---|
| Calidad (0–1) | mínimo laxo + mejoras opcionales; afecta a duración y eficacia |
| Desgaste | cada uso resta; se repara con la ligadura original |
| Humedad de objetos | afecta a ignición, peso y abrigo |
| Peso y volumen | limita lo que llevas; el zurrón y el cesto amplían |
| Tiempo real de procesos | secar, ahumar, cocer arcilla llevan horas de juego |
| Ruido y olor | delatan ante los animales |
| Estaciones (futuro) | disponibilidad de comida, duración del día, frío |

---

## 15. Construcción de base (modular)

El refugio de emergencia es de una pieza. La base no: se levanta módulo a módulo, y cada módulo tiene su calidad.

**Implementado (modo `B`):** poste (rejilla de 1 m con imán a postes cercanos), viga y pared de zarzo
(exigen apoyarse entre dos postes a 1,1–3,4 m), cubierta de corteza (exige apoyarse entre dos vigas
paralelas separadas 1–3,6 m: calcula el centro, el ángulo y el vano del tramo), fantasma verde/rojo
según validez y material disponible. Con estas cuatro piezas ya se puede levantar un refugio módulo a
módulo — postes, vigas, una pared de zarzo y un techo — que da tanto abrigo (`shelterQ`) como el
refugio de una pieza.

**Gestión de cualquier estructura ya puesta** (postes/vigas/zarzo/cubiertas y también fogata, refugio,
cama, trampa, recogedor de lluvia, filtro y secadero — no hace falta estar en modo construir):
- **`G` Desmontar** — apunta con cuchillo o hacha en mano, devuelve la mitad del coste original.
- **`H` Mover** — la recoges (gratis), aparece un fantasma que sigue tu mirada (postes/vigas respetan
  la misma rejilla/apoyo que al construir; el resto solo exige hueco libre y no estar en el agua),
  `E` para soltarla de nuevo, `Esc` para dejarla donde estaba.
- **`M` Reforzar** — con 2 unidades de un material de mejora de su receta (los mismos que suben la
  calidad al fabricarla) sube la calidad de una estructura ya construida, sin tener que rehacerla.

**Pendiente:** nivelar terreno, revoco, suelo, la cubierta a un/dos aguas con ángulo real (la actual
es un panel plano sin pendiente), el resto del catálogo de piezas (§ tabla siguiente) y el concepto
de interior/humo.

### Rejilla y colocación
- Rejilla blanda de **1 m** con imán a los postes ya puestos: las piezas encajan solas pero el conjunto no parece de cubos.
- **Fantasma** de la pieza en verde/rojo, rotación con la rueda, apoyo obligatorio (una viga necesita dos postes).
- **Nivelar** antes de construir: cavar y rellenar. Los postes se hincan y se ajustan a la pendiente.
- **Demoler** devuelve un porcentaje de material según el estado de la pieza.

### Capas de una construcción
Cada capa se puede saltar; el resultado simplemente será peor.

| Capa | Materiales | Aporta |
|---|---|---|
| 1. Armazón | postes, vigas, cordel | forma, sin protección |
| 2. Cerramiento | zarzo de varas, corteza, juncos, troncos | corta el viento |
| 3. Revoco | barro + paja + agua (cob) | aislamiento térmico real |
| 4. Cubierta | paja, corteza, tepe, juncos | estanqueidad a la lluvia (hecho: panel plano entre dos vigas) |
| 5. Suelo | tarima de troncos, tepe, grava | evita humedad del suelo |

### Piezas de construcción
| Pieza | Materiales | Notas |
|---|---|---|
| Poste | tronco / palo grueso | base de todo |
| Viga | tronco troceado | une postes, sostiene cubierta |
| Pared de zarzo | varas + cordel | ligera, poco aislante |
| Pared de troncos | leña + muescas | pesada, muy aislante |
| Panel de corteza | corteza + cordel | impermeable |
| Cubierta de corteza | corteza (entre dos vigas paralelas) | hecho — falta el ángulo (a un/dos aguas) |
| Tarima elevada | troncos + cordel | evita el frío del suelo y las alimañas |
| Puerta de zarzo | varas + bisagra de cuero | cierra el interior |
| Ventana / tronera | marco + postigo | luz sin perder tanto calor |
| Escalera / rampa | troncos | acceso a altillo o desnivel |
| Cerca / empalizada | estacas afiladas | animales fuera |
| Seto de zarzas | zarzas trasplantadas | barrera viva, lenta |

### Interior: qué convierte un montón de palos en una casa
- Un volumen cerrado (paredes + cubierta + suelo) pasa a contar como **interior**: sin lluvia, sin viento, temperatura propia que sube con el hogar.
- **Humo**: si hay hogar dentro sin salida, el humo intoxica. Chimenea de barro o agujero de ventilación → resuelto (y ahuyenta insectos).
- **Goteras**: la cubierta se degrada; con lluvia aparecen puntos de humedad hasta que reparas.
- **Pudrición**: madera en contacto con el suelo se pudre en semanas; sobre piedra o elevada, no.

### Mobiliario y estaciones de trabajo
| Objeto | Para qué |
|---|---|
| Banco de trabajo | desbloquea recetas finas y mejora la calidad base |
| Piedra de afilar fija | mantener filos |
| Catre / camastro | mejor descanso que la cama de suelo |
| Cestos y arcones | almacenaje con capacidad propia (la mochila deja de ser el límite) |
| Estantería / percha | secado y orden |
| Tendedero | secar ropa mojada |
| Secadero y ahumadero | conservar comida |
| **Leñera cubierta** | mantiene la leña **seca**: clave, la leña mojada no prende |
| Despensa elevada | comida a salvo de zorros |
| Hogar con reflector y chimenea | calor eficiente dentro |
| Candil de grasa / soporte de antorcha | luz estable de noche |
| Letrina | evita el estado *sucio* y la enfermedad |
| Corral | animales capturados vivos (aves, conejos) |
| Huerto | plantar semillas de bayas y tubérculos; requiere riego |
| Compostero | residuos → abono para el huerto |

### La base como lugar
- Punto de **reaparición** tras morir.
- Hito visible: humo de día, luz de noche (también te delata).
- Senda pisada hacia el agua y hacia el bosque: se marca sola con el uso.

---

## 16. Agua: captación, almacenamiento y tratamiento

### Captación
| Método | Requiere | Rinde | Notas |
|---|---|---|---|
| Recoger de arroyo/charca | recipiente | inmediato | cruda, hay que tratarla |
| Embudo de hoja/corteza | corteza | poco | apaño de emergencia bajo lluvia |
| Canalón de corteza partida en el tejado | corteza + cubierta | mucho al llover | la forma natural de abastecer la base |
| Tela extendida | tela/piel | medio | recoge lluvia limpia |
| Rocío al alba | trapo + hierba alta | poco, diario | fiable en secano |
| Bolsa de transpiración | bolsa + rama frondosa | poco, lento | agua limpia sin fuego |
| Trampa solar de condensación | hoyo + lámina + recipiente | poco | terreno húmedo |
| Pozo somero | pala/palo cavador, vaguada | constante | solo donde la capa freática esté alta |
| Acequia desde el arroyo | cavar | riego, no bebida | alimenta huerto y cisterna |
| Nieve/hielo derretidos | fuego | medio | gasta combustible |

### Almacenamiento
| Depósito | Capacidad | Problema |
|---|---|---|
| Cantimplora | 1 ración | — |
| Cubo de corteza sellado con resina | 3–4 | gotea con el tiempo |
| Odre de piel | 4–6 | necesita curtido |
| Tinaja de arcilla cocida | 10 | frágil, requiere horno |
| Tronco ahuecado | 15 | fijo, mucho trabajo |
| Cisterna revestida de arcilla | 40+ | fija; si no se cubre, se pudre y cría larvas |

El agua guardada tiene **estado**: fresca → estancada → podrida. Cubierta y a la sombra aguanta mucho más.

### Tratamiento
| Método | Requiere | Resultado |
|---|---|---|
| Decantar | tiempo, dos recipientes | quita sedimento |
| Filtrar | grava + arena + carbón + tela | quita turbidez, no patógenos |
| Hervir | recipiente + fuego (o piedras al rojo en corteza) | potable |
| Filtrar + hervir | ambos | potable y de buen sabor |

Estados del agua: **turbia → filtrada → hervida → potable**. Beber turbia enferma; filtrada sin hervir, menos.

---

## 17. Nadar y el agua como medio

Ahora el agua es una textura azul. Debería ser un sitio donde entras, con reglas propias.

### Profundidad
| Nivel | Efecto |
|---|---|
| Tobillo | ruido de chapoteo, calzado mojado |
| Rodilla | ‑30 % velocidad, se moja la ropa baja |
| Cintura | ‑60 % velocidad, consume vigor, mojado sube rápido |
| Pecho | flotas: empiezas a nadar |
| Nadando | velocidad baja, vigor se vacía, mojado al 100 % |

### Reglas
- **Peso**: cargado te hundes. Nadar con la mochila llena drena el doble de vigor; por encima del límite, no puedes — hay que soltar carga o dar la vuelta.
- **Frío del agua**: el agua roba calor mucho más rápido que el aire. Un baño de un minuto en marzo baja la temperatura corporal de golpe; salir sin fuego cerca es peligroso.
- **Corriente**: los arroyos arrastran. Cruzar por el punto malo te lleva río abajo y puedes perder un objeto de la mano.
- **Bucear**: aire limitado. Recoger arcilla del fondo, guijarros, sílex del cauce, plantas acuáticas; colocar y revisar nasas; pescar con lanza.
- **Salir**: mojado al máximo. O fuego, o refugio, o problema.

### Para qué sirve entrar
| Uso | Detalle |
|---|---|
| Atajar | cruzar en vez de rodear el lago |
| Lavarse | quita *sucio* y **olor**: mejoras el acecho |
| Escapar | un jabalí no te sigue a nado |
| Refrescarse | en días de calor, baja la temperatura |
| Pescar y bucear | lanza, nasa, recoger del fondo |
| Balsa | troncos + cordel: cruzar con la carga seca |
| Pértiga | tantear el vado antes de meterte |

---

## 18. Esconderse

### Postura
| Postura | Perfil | Ruido | Velocidad |
|---|---|---|---|
| De pie | alto | normal | 100 % |
| Agachado | medio | bajo | 55 % |
| Tumbado | bajo | mínimo | 15 % |
| Quieto | — | nulo | 0 % (el animal se calma) |

### Cómo te detectan
| Sentido | Qué lo dispara | Cómo se contrarresta |
|---|---|---|
| Vista | **movimiento** antes que silueta; distancia y luz | quedarse quieto, agacharse, cobertura, sombra |
| Olfato | viento **a favor** del animal | acercarse contra el viento, lavarse, barro, humo de pino |
| Oído | pisadas según suelo, romper ramas, talar | ir despacio, pisar musgo, descalzarse |

### Ocultación
Distinguir **ocultarse** (no te ven) de **cubrirse** (te protege): la hierba alta oculta pero no para a un jabalí.

| Escondite | Oculta | Notas |
|---|---|---|
| Hierba alta | ●●● agachado | el escondite básico; refuerza la hierba como elemento de juego |
| Matorral y zarzas | ●●● | ruidoso al entrar |
| Tronco caído | ●● | también cobertura real |
| Roca / saliente | ●● | rompe la silueta |
| Tras un tronco grueso | ●● | hay que rodear con el animal |
| Sombra nocturna | ●●● | se anula con antorcha encendida |
| Interior del refugio | ●●●● | seguro |

### Camuflaje y olor
- Barro encima: reduce olor y brillo de la piel.
- Capa vegetal (hierba y ramas atadas a la capa): rompe la silueta, penaliza velocidad.
- Humo de fuego de agujas: enmascara el olor durante un rato.
- Antorcha o fuego encendido: sigilo a cero, pero mantiene lejos a los depredadores.

### Alerta del animal
Tres estados visibles por su postura: **tranquilo** (pasta, baja la cabeza) → **alerta** (levanta la cabeza, mira, orejas) → **huida o carga**.
El acecho consiste en avanzar solo mientras está tranquilo y congelarse cuando levanta la cabeza.

---

## 19. Ruido y sonido

### El sonido como información (lo que oyes)
| Sonido | Qué te dice |
|---|---|
| Agua corriente | hay arroyo en esa dirección, a más volumen más cerca |
| Aves que se callan de golpe | algo grande se mueve cerca |
| Alarma de arrendajo | te han detectado a ti, o hay depredador |
| Crujido de rama | animal o peligro a menos de 20 m |
| Aullidos de noche | lobos en la zona; conviene fuego |
| Trueno lejano | tormenta en camino, ata la cubierta |
| Lluvia sobre hojas / sobre corteza / sobre agua | tres sonidos distintos: sabes si estás bajo dosel, bajo techo o al raso |
| Crepitar del fuego | vivo; si cambia a siseo, se está apagando o le cae agua |
| Zumbido de insectos | zona húmeda; hace falta humo |

### El ruido que haces tú
| Acción | Radio aprox. | Efecto |
|---|---|---|
| Quieto / tumbado | 0 m | nada |
| Andar sobre musgo o nieve | 5 m | mínimo |
| Andar sobre hojarasca | 15 m | los animales cercanos se alertan |
| Andar sobre grava / ramas | 20 m | idem |
| Vadear agua | 25 m | chapoteo |
| Correr | 35 m | espanta todo alrededor |
| Cortar ramas | 30 m | espanta caza menor |
| **Talar un árbol** | 80 m | vacía la zona de caza un buen rato |
| Golpear piedra (tallar sílex) | 40 m | repetitivo, muy delator |
| Grito / llamada | 120 m | ¿atraer? ¿ahuyentar? |

Consecuencia de diseño: **el campamento ruidoso espanta la caza**. Conviene talar lejos de donde pones las trampas.

### Implementación técnica (sin assets externos)
Todo el audio se sintetiza en el navegador con Web Audio API:
- **Viento**: ruido blanco filtrado paso bajo, con la frecuencia de corte y ganancia atadas a la variable de viento que ya existe.
- **Lluvia**: ruido rosa + filtro, mezcla distinta según estés bajo dosel o bajo techo (reutiliza `canopy` y `shelterQ`).
- **Fuego**: ruido filtrado con envolventes cortas aleatorias para el chisporroteo; volumen por distancia a la hoguera.
- **Agua**: ruido paso banda posicionado en el arroyo más cercano, panorámica según orientación.
- **Pasos**: ráfagas cortas de ruido con el filtro cambiado por tipo de suelo, disparadas por el ciclo de marcha.
- **Fauna**: cantos y alarmas como osciladores modulados; no hacen falta muestras.
- **Ambiente por hora y bioma**: aves al alba, grillos de noche, silencio de mediodía.

Accesibilidad: indicador visual opcional de dirección del sonido relevante (arroyo, animal, trueno).

### Verbo nuevo: Escuchar
Quedarse quieto y escuchar unos segundos revela pistas direccionales del entorno: agua, animales, tormenta. Es el equivalente auditivo de mirar el mapa — y encaja con no tener mapa.

---

## 20. Orden de implementación propuesto

**Fase 1 — arreglar y dar manos (lo inmediato)**
1. Verbo *usar / equipar / examinar* + manos visibles + barra rápida. (Corrige el fallo actual.)
2. Hierba baja universal que oculta objetos + rebuscar.
3. Troncos caídos, tocones huecos, rocas: nuevas fuentes de material.
4. Más materiales por zona (tabla §4 completa).

**Fase 2 — vida y comida**
5. Fauna básica: conejo, ave, corzo. Rastro, acecho, huida.
6. Lanza y trampas mejoradas; despiece con piel y tendón.
7. Arroyos con cauce; **nadar, vadear y bucear**; pesca con caña y nasa.
7b. **Sigilo**: postura, cobertura, viento y olor, alerta del animal en tres estados.
8. Cocina real: asar, hervir en recipiente, estados de la comida.

**Fase 2b — sonido (transversal, se puede adelantar)**
8b. Audio sintetizado: viento, lluvia según cobertura, fuego, arroyo, pasos por tipo de suelo.
8c. Ruido propio con radio por acción; la caza se espanta. Verbo *Escuchar*.

**Fase 3 — asentarse (base)**
9. Construcción modular: rejilla blanda, fantasma, postes, vigas, paredes, cubierta, demoler.
10. Concepto de *interior*: sin lluvia ni viento, temperatura propia, humo y ventilación.
11. Almacenaje fuera de la mochila: cestos, arcones, leñera seca, despensa.
12. Captación de agua: canalón en el tejado → cisterna; filtro de arena y carbón; estados del agua.
13. Refugios específicos por lugar (§6) como versión rápida de lo anterior.

**Fase 4 — vivir allí**
14. Banco de trabajo, secadero, ahumadero, hogar con chimenea, luz.
15. Arcilla y cerámica: tinaja, olla, horno.
16. Huerto, corral, compost, riego con el agua recogida.
17. Degradación: goteras, pudrición, reparación.

**Fase 5 — profundidad**
18. Desgaste, reparación y afilado de herramientas.
19. Peso y volumen; decisiones de carga; trineo o angarillas.
20. Diario, orientación, hitos y senda pisada.
21. Estaciones y clima largo.
