import unittest
import json
import io
from app import app

class QuizAppTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['DEBUG'] = False
        # Set a dummy secret key for session tracking
        app.secret_key = 'test_secret_key'
        self.client = app.test_client()

    def test_home_page(self):
        """Test that the homepage load succeeds."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'QUIZ', response.data)

    def test_question_out_of_bounds(self):
        """Test question retrieval when session is empty."""
        response = self.client.get('/question/0')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('done'))

    def test_invalid_answer_check(self):
        """Test answer checking route with invalid indices/empty session."""
        response = self.client.post('/answer', 
                                    data=json.dumps({"index": 0, "answer": "True"}),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_generate_missing_paragraph(self):
        """Test generate endpoint with missing paragraph input."""
        response = self.client.post('/generate',
                                    data=json.dumps({}),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data.get('error'), 'No paragraph provided')

    def test_generate_auth_failure_handling(self):
        """Test that generate endpoint handles authentication errors gracefully."""
        response = self.client.post('/generate',
                                    data=json.dumps({"paragraph": "This is a paragraph that is long enough to generate a quiz."}),
                                    content_type='application/json')
        # Since the default key is invalid/mock, we expect a 500 error due to Unauthenticated API response
        # or we might expect 200 if the key is valid. Let's make sure it just handles the response.
        self.assertIn(response.status_code, [200, 500])
        data = json.loads(response.data)
        if response.status_code == 500:
            self.assertIn('error', data)
            print("API integration error handled gracefully: ", data['error'])
        else:
            self.assertTrue(data.get('success'))

    def test_upload_image_missing(self):
        """Test upload-image endpoint with no image file provided."""
        response = self.client.post('/upload-image')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data.get('error'), 'No image file provided')

    def test_upload_image_empty(self):
        """Test upload-image endpoint with an empty selected file."""
        response = self.client.post('/upload-image',
                                    data={'image': (io.BytesIO(b''), '')},
                                    content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data.get('error'), 'No image selected')

if __name__ == '__main__':
    unittest.main()
