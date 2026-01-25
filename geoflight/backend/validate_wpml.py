"""Script para validar que el WPML generado sea compatible con DJI Fly RC2."""

import sys
import zipfile
import re
from pathlib import Path

def validate_wpml(kmz_path: str) -> bool:
    """Valida un archivo KMZ generado."""
    errors = []
    warnings = []

    # Extraer waylines.wpml del KMZ
    try:
        with zipfile.ZipFile(kmz_path, 'r') as z:
            wpml_content = z.read('wpmz/waylines.wpml').decode('utf-8')
    except Exception as e:
        print(f"ERROR: No se pudo leer el KMZ: {e}")
        return False

    print(f"Validando: {kmz_path}\n")
    print("=" * 60)

    # 1. Verificar que NO exista useGlobalSpeed
    if '<wpml:useGlobalSpeed>' in wpml_content:
        errors.append("useGlobalSpeed encontrado (debe ser eliminado)")
    else:
        print("✓ useGlobalSpeed: NO presente (correcto)")

    # 2. Verificar executeHeight sea entero
    heights = re.findall(r'<wpml:executeHeight>([^<]+)</wpml:executeHeight>', wpml_content)
    decimal_heights = [h for h in heights if '.' in h]
    if decimal_heights:
        errors.append(f"executeHeight con decimales: {decimal_heights[:3]}...")
    else:
        print(f"✓ executeHeight: Todos enteros ({heights[0] if heights else 'N/A'})")

    # 3. Verificar useStraightLine = 0
    straight_lines = re.findall(r'<wpml:useStraightLine>([^<]+)</wpml:useStraightLine>', wpml_content)
    non_zero = [s for s in straight_lines if s != '0']
    if non_zero:
        errors.append(f"useStraightLine != 0 encontrado: {non_zero[:3]}")
    else:
        print(f"✓ useStraightLine: Todos son 0 (correcto)")

    # 4. Verificar waypointHeadingAngle = 0
    heading_angles = re.findall(r'<wpml:waypointHeadingAngle>([^<]+)</wpml:waypointHeadingAngle>', wpml_content)
    non_zero_headings = [h for h in heading_angles if h != '0']
    if non_zero_headings:
        errors.append(f"waypointHeadingAngle != 0 encontrado: {non_zero_headings[:3]}")
    else:
        print(f"✓ waypointHeadingAngle: Todos son 0 (correcto)")

    # 5. Verificar gimbalEvenlyRotate pitch
    evenly_pitches = re.findall(
        r'gimbalEvenlyRotate.*?<wpml:gimbalPitchRotateAngle>([^<]+)</wpml:gimbalPitchRotateAngle>',
        wpml_content, re.DOTALL
    )
    zero_pitches = [p for p in evenly_pitches if p == '0']
    if zero_pitches:
        errors.append(f"gimbalEvenlyRotate con pitch=0 encontrado ({len(zero_pitches)} veces)")
    else:
        print(f"✓ gimbalEvenlyRotate pitch: No hay pitch=0 (correcto)")

    # 6. Verificar waypointGimbalPitchAngle = 0
    gimbal_pitches = re.findall(r'<wpml:waypointGimbalPitchAngle>([^<]+)</wpml:waypointGimbalPitchAngle>', wpml_content)
    non_zero_gimbal = [g for g in gimbal_pitches if g != '0']
    if non_zero_gimbal:
        errors.append(f"waypointGimbalPitchAngle != 0 encontrado: {non_zero_gimbal[:3]}")
    else:
        print(f"✓ waypointGimbalPitchAngle: Todos son 0 (correcto)")

    # 7. Verificar takePhoto solo en primer waypoint
    take_photos = re.findall(r'<wpml:index>(\d+)</wpml:index>.*?takePhoto', wpml_content, re.DOTALL)
    if len(take_photos) > 1:
        errors.append(f"takePhoto en múltiples waypoints: indices {take_photos}")
    elif len(take_photos) == 1 and take_photos[0] == '0':
        print(f"✓ takePhoto: Solo en waypoint 0 (correcto)")
    elif len(take_photos) == 0:
        warnings.append("No se encontró ningún takePhoto")

    # 8. Verificar gimbalRollRotateEnable = 1
    roll_enables = re.findall(r'<wpml:gimbalRollRotateEnable>([^<]+)</wpml:gimbalRollRotateEnable>', wpml_content)
    if roll_enables and roll_enables[0] != '1':
        errors.append(f"gimbalRollRotateEnable != 1: {roll_enables[0]}")
    else:
        print(f"✓ gimbalRollRotateEnable: Es 1 (correcto)")

    # Contar waypoints y action groups
    waypoint_count = len(re.findall(r'<Placemark>', wpml_content))
    action_group_count = len(re.findall(r'<wpml:actionGroup>', wpml_content))
    action_count = len(re.findall(r'<wpml:action>', wpml_content))

    print("\n" + "=" * 60)
    print(f"Estadísticas:")
    print(f"  - Waypoints: {waypoint_count}")
    print(f"  - Action Groups: {action_group_count}")
    print(f"  - Actions: {action_count}")

    # Resumen
    print("\n" + "=" * 60)
    if errors:
        print(f"\n❌ ERRORES ENCONTRADOS ({len(errors)}):")
        for e in errors:
            print(f"   - {e}")
        return False
    else:
        print("\n✅ VALIDACIÓN EXITOSA - El archivo debería funcionar en DJI Fly RC2")
        if warnings:
            print(f"\n⚠️ Advertencias ({len(warnings)}):")
            for w in warnings:
                print(f"   - {w}")
        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python validate_wpml.py <archivo.kmz>")
        print("\nEjemplo:")
        print("  python validate_wpml.py mission_grid_10wp.kmz")
        sys.exit(1)

    kmz_path = sys.argv[1]
    if not Path(kmz_path).exists():
        print(f"ERROR: Archivo no encontrado: {kmz_path}")
        sys.exit(1)

    success = validate_wpml(kmz_path)
    sys.exit(0 if success else 1)
