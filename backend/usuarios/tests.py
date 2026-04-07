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
