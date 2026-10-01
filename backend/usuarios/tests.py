from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import DetallePrestamo, Equipo, Estudiante, Prestamo


class PrestamoRecepcionTests(APITestCase):
	def setUp(self):
		self.admin = Estudiante.objects.create_user(
			username='admin',
			password='secret123',
			email='admin@ulsa.edu.ni',
			is_staff=True,
		)
		self.student = Estudiante.objects.create_user(
			username='alumno',
			password='secret123',
			email='alumno@est.ulsa.edu.ni',
			carnet='2024001',
			carrera='ICE',
			ano_cursado='3',
		)
		self.equipment = Equipo.objects.create(
			nombre='Balón oficial',
			cantidad_total=10,
			cantidad_disponible=10,
		)
		self.loan = Prestamo.objects.create(
			estudiante=self.student,
			fecha_devolucion=timezone.now() + timedelta(days=2),
			estado='PENDIENTE',
		)
		DetallePrestamo.objects.create(prestamo=self.loan, equipo=self.equipment, cantidad=1)
		self.detail_url = reverse('prestamo-detail', args=[self.loan.id])

	def test_admin_status_transition_tracks_delivery_and_reception_staff(self):
		self.client.force_authenticate(user=self.admin)

		approve_response = self.client.patch(self.detail_url, {'estado': 'ACTIVO'}, format='json')

		self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
		self.loan.refresh_from_db()
		self.assertEqual(self.loan.entregado_por, self.admin)
		self.assertIsNone(self.loan.recibido_por)
		self.assertIsNone(self.loan.fecha_recepcion)

		return_response = self.client.patch(self.detail_url, {'estado': 'DEVUELTO'}, format='json')

		self.assertEqual(return_response.status_code, status.HTTP_200_OK)
		self.loan.refresh_from_db()
		self.assertEqual(self.loan.recibido_por, self.admin)
		self.assertIsNotNone(self.loan.fecha_recepcion)

	def test_student_cannot_update_loan_status(self):
		self.client.force_authenticate(user=self.student)

		response = self.client.patch(self.detail_url, {'estado': 'DEVUELTO'}, format='json')

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ReglasNegocioFase2Tests(APITestCase):
	def setUp(self):
		self.admin = Estudiante.objects.create_user(
			username='admin_fn',
			password='secret123',
			email='admin_fn@ulsa.edu.ni',
			is_staff=True,
		)
		self.student = Estudiante.objects.create_user(
			username='alumno_fn',
			password='secret123',
			email='alumno_fn@est.ulsa.edu.ni',
			carnet='2024999',
			carrera='IGI',
			ano_cursado='2',
		)
		self.equipment = Equipo.objects.create(
			nombre='Balón Baloncesto',
			cantidad_total=5,
			cantidad_disponible=5,
		)
		self.loan = Prestamo.objects.create(
			estudiante=self.student,
			fecha_devolucion=timezone.now() + timedelta(days=1),
			estado='PENDIENTE',
		)
		DetallePrestamo.objects.create(prestamo=self.loan, equipo=self.equipment, cantidad=1)
		self.detail_url = reverse('prestamo-detail', args=[self.loan.id])

	def test_admin_rejects_loan_persists_motivo_rechazo_and_audit(self):
		self.client.force_authenticate(user=self.admin)
		motivo = 'Equipo solicitado en mantenimiento preventivo'

		response = self.client.patch(
			self.detail_url,
			{'estado': 'RECHAZADO', 'motivo_rechazo': motivo},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.loan.refresh_from_db()
		self.assertEqual(self.loan.estado, 'RECHAZADO')
		self.assertEqual(self.loan.motivo_rechazo, motivo)

	def test_admin_rejects_loan_with_default_motivo_when_empty(self):
		self.client.force_authenticate(user=self.admin)

		response = self.client.patch(
			self.detail_url,
			{'estado': 'RECHAZADO'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.loan.refresh_from_db()
		self.assertEqual(self.loan.estado, 'RECHAZADO')
		self.assertIn('sin motivo especificado', self.loan.motivo_rechazo.lower())

	def test_actualizar_estado_sancion_auto_resolves_expired_sanctions(self):
		from .models import Sancion
		hoy = timezone.localdate()
		sancion = Sancion.objects.create(
			estudiante=self.student,
			creada_por=self.admin,
			motivo='Sanción de prueba temporal',
			severidad='restriction',
			fecha_inicio=hoy - timedelta(days=7),
			fecha_fin=hoy - timedelta(days=1),
			activa=True,
		)
		self.student.sancionado = True
		self.student.save(update_fields=['sancionado'])

		# Ejecutar actualización
		sancionado = self.student.actualizar_estado_sancion()

		self.assertFalse(sancionado)
		self.student.refresh_from_db()
		self.assertFalse(self.student.sancionado)
		sancion.refresh_from_db()
		self.assertFalse(sancion.activa)
		self.assertIsNotNone(sancion.fecha_resolucion)

	def test_procesar_atrasados_command_transitions_overdue_active_loans(self):
		from .management.commands.procesar_atrasados import ejecutar_procesamiento_atrasados
		from .models import Sancion

		# Crear un préstamo ACTIVO vencido
		prestamo_activo = Prestamo.objects.create(
			estudiante=self.student,
			fecha_devolucion=timezone.now() - timedelta(hours=3),
			estado='ACTIVO',
		)
		DetallePrestamo.objects.create(prestamo=prestamo_activo, equipo=self.equipment, cantidad=1)

		total, ids = ejecutar_procesamiento_atrasados()
		self.assertGreaterEqual(total, 1)
		self.assertIn(prestamo_activo.id, ids)

		prestamo_activo.refresh_from_db()
		self.assertEqual(prestamo_activo.estado, 'ATRASADO')

		# Verificar que se creó una sanción automática
		sancion = Sancion.objects.filter(estudiante=self.student, activa=True, motivo__contains=f'#{prestamo_activo.id}').first()
		self.assertIsNotNone(sancion)

		# Idempotencia: segunda ejecución debe dar 0 para este préstamo
		total_segundo, ids_segundo = ejecutar_procesamiento_atrasados()
		self.assertNotIn(prestamo_activo.id, ids_segundo)


class SeguridadFase3Tests(APITestCase):
	def setUp(self):
		from rest_framework.authtoken.models import Token
		self.admin = Estudiante.objects.create_user(
			username='admin_sec',
			password='password123',
			email='admin_sec@ulsa.edu.ni',
			is_staff=True,
		)
		self.student = Estudiante.objects.create_user(
			username='alumno_sec',
			password='password123',
			email='alumno_sec@est.ulsa.edu.ni',
			carnet='2024888',
			carrera='LAF',
			ano_cursado='1',
		)

	def test_expired_token_is_rejected_and_deleted(self):
		from rest_framework.authtoken.models import Token
		token = Token.objects.create(user=self.student)
		# Simular token de hace 25 horas
		Token.objects.filter(pk=token.pk).update(created=timezone.now() - timedelta(hours=25))

		response = self.client.get(
			reverse('auth_me'),
			HTTP_AUTHORIZATION=f'Token {token.key}',
		)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertIn('expirado', response.data.get('detail', '').lower())
		self.assertFalse(Token.objects.filter(key=token.key).exists())

	def test_login_rotates_token(self):
		from rest_framework.authtoken.models import Token
		# Primer login
		r1 = self.client.post(reverse('auth_login'), {'email': 'alumno_sec@est.ulsa.edu.ni', 'password': 'password123'}, format='json')
		self.assertEqual(r1.status_code, status.HTTP_200_OK)
		token1 = r1.data['token']

		# Segundo login (debe generar un nuevo token y descartar el viejo)
		r2 = self.client.post(reverse('auth_login'), {'email': 'alumno_sec@est.ulsa.edu.ni', 'password': 'password123'}, format='json')
		self.assertEqual(r2.status_code, status.HTTP_200_OK)
		token2 = r2.data['token']

		self.assertNotEqual(token1, token2)
		self.assertFalse(Token.objects.filter(key=token1).exists())
		self.assertTrue(Token.objects.filter(key=token2).exists())

	def test_logout_invalidates_token(self):
		from rest_framework.authtoken.models import Token
		token = Token.objects.create(user=self.student)

		logout_res = self.client.post(
			reverse('auth_logout'),
			HTTP_AUTHORIZATION=f'Token {token.key}',
		)
		self.assertEqual(logout_res.status_code, status.HTTP_200_OK)
		self.assertFalse(Token.objects.filter(key=token.key).exists())

		# Intentar acceder con token invalidado
		me_res = self.client.get(
			reverse('auth_me'),
			HTTP_AUTHORIZATION=f'Token {token.key}',
		)
		self.assertEqual(me_res.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_my_ip_restricted_to_admin(self):
		from rest_framework.authtoken.models import Token
		token_student = Token.objects.create(user=self.student)
		token_admin = Token.objects.create(user=self.admin)

		# Anónimo -> 401
		r_anon = self.client.get(reverse('my_ip'))
		self.assertEqual(r_anon.status_code, status.HTTP_401_UNAUTHORIZED)

		# Estudiante -> 403
		r_student = self.client.get(reverse('my_ip'), HTTP_AUTHORIZATION=f'Token {token_student.key}')
		self.assertEqual(r_student.status_code, status.HTTP_403_FORBIDDEN)

		# Admin -> 200
		r_admin = self.client.get(reverse('my_ip'), HTTP_AUTHORIZATION=f'Token {token_admin.key}')
		self.assertEqual(r_admin.status_code, status.HTTP_200_OK)
		self.assertIn('ip_detectada', r_admin.data)


class CalidadFase4Tests(APITestCase):
	def setUp(self):
		self.admin = Estudiante.objects.create_user(
			username='admin_calidad',
			password='password123',
			email='admin_calidad@ulsa.edu.ni',
			is_staff=True,
		)
		self.student = Estudiante.objects.create_user(
			username='alumno_calidad',
			password='password123',
			email='alumno_calidad@est.ulsa.edu.ni',
			carnet='2024777',
			carrera='IMS',
			ano_cursado='3',
		)
		self.equipment = Equipo.objects.create(
			nombre='Balón Voleibol',
			cantidad_total=3,
			cantidad_disponible=3,
		)

	def test_servicio_inventario_recalcula_y_previene_overbooking(self):
		from .services.inventario import recalcular_disponibilidad_equipo, validar_disponibilidad_para_prestamo
		from django.core.exceptions import ValidationError

		# Inicialmente 3 disponibles
		self.assertEqual(recalcular_disponibilidad_equipo(self.equipment.id), 3)

		# Crear un préstamo activo de 2 unidades
		loan = Prestamo.objects.create(
			estudiante=self.student,
			estado='ACTIVO',
			fecha_devolucion=timezone.now() + timedelta(hours=4),
		)
		detalle = DetallePrestamo.objects.create(prestamo=loan, equipo=self.equipment, cantidad=2)

		# Ahora quedan 3 - 2 = 1 disponible
		disp = recalcular_disponibilidad_equipo(self.equipment.id)
		self.assertEqual(disp, 1)

		# Intentar validar préstamo de 2 unidades adicionales debe lanzar ValidationError (queda solo 1)
		with self.assertRaises(ValidationError):
			validar_disponibilidad_para_prestamo([{'equipo': self.equipment.id, 'cantidad': 2}])

		# Al devolver el préstamo, la disponibilidad vuelve a 3
		loan.estado = 'DEVUELTO'
		loan.save()
		disp_devuelto = recalcular_disponibilidad_equipo(self.equipment.id)
		self.assertEqual(disp_devuelto, 3)

	def test_custom_exception_handler_formats_errors(self):
		self.client.force_authenticate(user=self.admin)
		# Enviar datos inválidos (nombre vacío)
		res = self.client.post(
			reverse('equipo-list'),
			{'nombre': ''},
			format='json',
		)
		self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('status_code', res.data)
		self.assertIn('detail', res.data)

	def test_health_check_endpoint_public_and_minimal(self):
		# No autenticado
		self.client.force_authenticate(user=None)
		res = self.client.get(reverse('health_check'))
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		self.assertEqual(res.data.get('status'), 'ok')
		self.assertEqual(res.data.get('service'), 'mosq-sgped-api')
		# No debe exponer datos sensibles
		self.assertNotIn('database', res.data)
		self.assertNotIn('secret_key', res.data)

	def test_qr_signed_token_and_legacy_validation(self):
		self.client.force_authenticate(user=self.admin)
		loan = Prestamo.objects.create(
			estudiante=self.student,
			estado='PENDIENTE',
		)
		DetallePrestamo.objects.create(prestamo=loan, equipo=self.equipment, cantidad=1)

		# 1. Probar token firmado generado
		token = loan.get_signed_qr_token()
		self.assertIn('MOSQ-QR:', token)

		res_signed = self.client.post(
			reverse('prestamo-validar-qr'),
			{'qr_data': token},
			format='json',
		)
		self.assertEqual(res_signed.status_code, status.HTTP_200_OK)
		self.assertTrue(res_signed.data.get('valid'))
		self.assertEqual(res_signed.data.get('loan_id'), loan.id)

		# 2. Probar compatibilidad retrospectiva: formato legacy MOSQ-LOAN-{id}
		res_legacy = self.client.post(
			reverse('prestamo-validar-qr'),
			{'qr_data': f'MOSQ-LOAN-{loan.id}'},
			format='json',
		)
		self.assertEqual(res_legacy.status_code, status.HTTP_200_OK)
		self.assertEqual(res_legacy.data.get('loan_id'), loan.id)

		# 3. Probar token alterado
		res_bad = self.client.post(
			reverse('prestamo-validar-qr'),
			{'qr_data': token + 'badsignature'},
			format='json',
		)
		self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

	def test_devolucion_con_dano_traslada_a_mantenimiento(self):
		self.client.force_authenticate(user=self.admin)
		# Equipo con 3 disponibles inicialmente
		self.assertEqual(self.equipment.cantidad_disponible, 3)
		self.assertEqual(self.equipment.cantidad_mantenimiento, 0)

		# Crear préstamo activo
		loan = Prestamo.objects.create(
			estudiante=self.student,
			estado='ACTIVO',
		)
		DetallePrestamo.objects.create(prestamo=loan, equipo=self.equipment, cantidad=1)
		# Descuenta 1: queda 2 disponible
		self.equipment.refresh_from_db()
		self.assertEqual(self.equipment.cantidad_disponible, 2)

		# Devolver con daño reportado
		res = self.client.patch(
			reverse('prestamo-detail', kwargs={'pk': loan.id}),
			{
				'estado': 'DEVUELTO',
				'estado_devolucion': 'DANADO',
				'observaciones_devolucion': 'Eje doblado durante la práctica',
			},
			format='json',
		)
		self.assertEqual(res.status_code, status.HTTP_200_OK)

		loan.refresh_from_db()
		self.assertEqual(loan.estado, 'DEVUELTO')
		self.assertEqual(loan.estado_devolucion, 'DANADO')

		# Verificar efecto en inventario: la unidad dañada pasa a mantenimiento
		self.equipment.refresh_from_db()
		self.assertEqual(self.equipment.cantidad_mantenimiento, 1)
		# No regresa a disponible (sigue en 2 porque 1 está en mantenimiento de un total de 3)
		self.assertEqual(self.equipment.cantidad_disponible, 2)

	def test_procesar_atrasados_envia_recordatorios_preventivos(self):
		from usuarios.management.commands.procesar_atrasados import ejecutar_recordatorios_preventivos
		ahora = timezone.now()
		# Préstamo activo que vence dentro de 45 minutos (en la ventana de 2 horas)
		loan_cercano = Prestamo.objects.create(
			estudiante=self.student,
			estado='ACTIVO',
			fecha_devolucion=ahora + timezone.timedelta(minutes=45),
			recordatorio_enviado=False,
		)
		DetallePrestamo.objects.create(prestamo=loan_cercano, equipo=self.equipment, cantidad=1)

		total_recordatorios = ejecutar_recordatorios_preventivos()
		self.assertGreaterEqual(total_recordatorios, 1)

		loan_cercano.refresh_from_db()
		self.assertTrue(loan_cercano.recordatorio_enviado)

		# Ejecución repetida no duplica recordatorios (idempotente)
		seg_recordatorios = ejecutar_recordatorios_preventivos()
		self.assertEqual(seg_recordatorios, 0)


	def test_estadisticas_dashboard_permissions_and_data(self):
		# Estudiante normal no debe tener acceso
		self.client.force_authenticate(user=self.student)
		res_denied = self.client.get(reverse('reporte_estadisticas'))
		self.assertEqual(res_denied.status_code, status.HTTP_403_FORBIDDEN)

		# Administrador tiene acceso con métricas completas
		self.client.force_authenticate(user=self.admin)
		res = self.client.get(reverse('reporte_estadisticas'))
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		self.assertIn('top_equipos', res.data)
		self.assertIn('atrasos_por_carrera', res.data)
		self.assertIn('prestamos_por_mes', res.data)
		self.assertIn('distribucion_estados', res.data)


