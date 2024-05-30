pipeline {
    agent any

    stages {
        // stage('Build And Test') {
        //     steps {
        //         container('node') {
        //             sh 'npm ci'
        //             sh 'npm run build'
        //         }
        //     }
        // }

        stage('Docker Build and Push') {
            steps {
                container('kaniko') {
                    sh '''
                    /kaniko/executor --destination=992256429851.dkr.ecr.us-east-2.amazonaws.com/demo:latest --verbosity=info
                    '''
                }
            }
        }
    }
}
